/**
 * Telegram update router + handlers.
 *
 * Security model: the acting user is ALWAYS `resolveUser(fromId)` — a
 * server-verified, HMAC-signed link that is re-checked on every update.
 * Nothing in message text or callback data can select another user's data;
 * ids in callbacks are only looked up inside the resolved user's collection.
 *
 * UX model:
 *  - a persistent bottom keyboard (KEYS) for the main actions
 *  - typing "5 coffee" / "+100 salary" starts a confirmed quick add
 *  - inline buttons EDIT the message they're on instead of posting new ones
 */
import { totals, periodReport, budgetUsage, sumByType, periodRange } from '../../../src/shared/finance.js'
import { categoryInfo } from '../../../src/shared/categories.js'
import { linkWithCode, resolveUser, unlink } from '../security/linking.js'
import { parseAddArgs, parseAmount, cleanDescription, slug, splitCategory, parseQuickEntry } from '../security/validation.js'
import { randomToken } from '../security/crypto.js'
import { PreconditionError } from '../firebase/client.js'
import * as kb from './keyboards.js'
import { guessCategory } from './guess.js'
import {
  esc, money, signedMoney, longDate, monthTitle, todayIn, dayBefore, catEmoji,
  TYPE_LABEL, TYPE_ICON, ERRORS, HELP, NOT_LINKED,
} from './messages.js'

const SESSION_TTL_MS = 10 * 60 * 1000
const TX_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

// Shown when the user taps Telegram's "Menu" button (left of the message box).
// Most-used first; each one is a single tap.
export const BOT_COMMANDS = [
  { command: 'add', description: '➕ Add expense or income' },
  { command: 'balance', description: '💰 Balance and totals' },
  { command: 'report', description: '📊 This month\'s report' },
  { command: 'recent', description: '🧾 Latest 10 transactions' },
  { command: 'expense_today', description: '📤 What I spent today' },
  { command: 'income', description: '📥 This month\'s income' },
  { command: 'budget', description: '🎯 Budgets this month' },
  { command: 'report_year', description: '📅 This year\'s report' },
  { command: 'delete', description: '🗑 Delete a transaction' },
  { command: 'settings', description: '⚙️ Settings' },
  { command: 'menu', description: '📋 Show the button keyboard' },
  { command: 'help', description: '❓ How to use the bot' },
]
let commandsRegistered = false
export const _resetCommandRegistration = () => { commandsRegistered = false }

// ── Entry point ───────────────────────────────────────────────────────────────
export async function handleUpdate(update, deps) {
  if (update.callback_query) return handleCallback(update.callback_query, deps)
  const msg = update.message
  if (!msg?.from || msg.from.is_bot || !msg.chat) return

  // Financial data only in 1:1 chats — never in groups
  if (msg.chat.type !== 'private') {
    return deps.tg.send(msg.chat.id, '🔒 For your privacy, please message me in a private chat.')
  }

  const chatId = msg.chat.id
  const text = (msg.text || '').trim()
  const m = text.match(/^\/([A-Za-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/)
  const cmd = m ? m[1].toLowerCase() : null
  const args = m ? (m[2] || '').trim() : ''

  if (cmd === 'start' || cmd === 'menu' || cmd === 'help') registerCommandsOnce(deps)
  if (cmd === 'start' && args) return handleStartLink(chatId, msg.from, args, deps)

  const user = await resolveUser(deps.fs, deps.env, msg.from.id)
  if (!user) {
    if (cmd === 'help') return deps.tg.send(chatId, `${HELP}\n\n${NOT_LINKED}`)
    if (cmd === 'start') return deps.tg.send(chatId, `👋 <b>Welcome to Smart Money Tracking!</b>\n\n${NOT_LINKED}`)
    return deps.tg.send(chatId, NOT_LINKED)
  }

  const ctx = makeCtx(deps, msg.from, chatId, user)
  ctx.sourceId = `${chatId}_${msg.message_id}` // makes instant saves idempotent per message
  if (cmd) return runCommand(ctx, cmd, args)
  return handleText(ctx, text)
}

/**
 * Register the command list + the "Menu" button with Telegram. Telegram keeps
 * these permanently; we refresh once per Worker instance (in the background,
 * so the reply isn't delayed) whenever someone sends /start or /menu or links.
 */
function registerCommandsOnce(deps) {
  if (commandsRegistered) return
  commandsRegistered = true
  deps.background(Promise.all([deps.tg.setCommands(BOT_COMMANDS), deps.tg.setMenuButton()]))
}

function makeCtx(deps, from, chatId, user, messageId) {
  const timezone = user.settings.timezone || deps.env.DEFAULT_TIMEZONE || 'UTC'
  return {
    ...deps,
    tgId: String(from.id),
    chatId,
    messageId,
    uid: user.uid,
    settings: user.settings,
    session: user.session,
    currency: user.prefs?.currency === 'KHR' ? 'KHR' : 'USD',
    today: todayIn(timezone),
    /** Edit the tapped message (buttons) or send a new one (typed input). */
    show: (text, keyboard) => (messageId
      ? deps.tg.edit(chatId, messageId, text, keyboard)
      : deps.tg.send(chatId, text, keyboard)),
    send: (text, keyboard) => deps.tg.send(chatId, text, keyboard),
  }
}

/** Instant save is the default; users can switch the confirm screen back on in ⚙️ Settings. */
const confirmMode = (ctx) => ctx.settings.confirmBeforeSave === true

const activeSession = (ctx) => {
  const s = ctx.session
  return s && s.expiresAt && Date.parse(s.expiresAt) > Date.now() ? s : null
}
const saveSession = (ctx, fields) => {
  const s = { ...fields, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
  ctx.session = s
  return ctx.data.setSession(ctx.tgId, s)
}
const endSession = (ctx) => { ctx.session = null; return ctx.data.clearSession(ctx.tgId).catch(() => {}) }

// ── Linking ───────────────────────────────────────────────────────────────────
async function handleStartLink(chatId, from, code, deps) {
  const result = await linkWithCode(deps.fs, deps.env, code, from)
  const messages = {
    invalid: '❌ That link code isn\'t valid. Please create a new one in the app (Settings → Telegram bot).',
    expired: '⌛ That link code has expired (codes last 5 minutes). Please create a new one in the app.',
    used: '❌ That link code was already used. Please create a new one in the app.',
    telegram_already_linked: '⚠️ This Telegram account is already connected to another Smart Money Tracking account. Send /unlink first, then try again.',
    account_already_linked: '⚠️ That Smart Money Tracking account is already connected to a different Telegram account. Disconnect it in the app first (Settings → Telegram bot).',
  }
  if (!result.ok) return deps.tg.send(chatId, messages[result.reason] || ERRORS.generic)
  console.log(JSON.stringify({ event: 'account_linked' }))
  return deps.tg.send(chatId, `✅ <b>Connected!</b>\n\n${welcomeText()}`, kb.mainKeyboard())
}

const welcomeText = () =>
  '⚡ <b>Just type an amount — it\'s saved instantly:</b>\n' +
  '• <code>5</code> or <code>5 coffee</code> — expense\n' +
  '• <code>+100</code> or <code>+100 salary</code> — income\n' +
  'Wrong category? One tap fixes it. ↩️ Undo is always there.\n\n' +
  'Or use the buttons below 👇'

// ── Bottom-keyboard buttons and typed text ────────────────────────────────────
async function handleText(ctx, text) {
  switch (text) {
    case kb.KEYS.expense: return beginAdd(ctx, 'expense')
    case kb.KEYS.income: return beginAdd(ctx, 'income')
    case kb.KEYS.balance: return showBalance(ctx)
    case kb.KEYS.report: return showReport(ctx, 'month', ctx.today.slice(0, 7))
    case kb.KEYS.recent: return showRecent(ctx)
    case kb.KEYS.budget: return showBudget(ctx)
    case kb.KEYS.more: return ctx.show('☰ <b>More</b>', kb.moreMenu())
    default: break
  }

  const s = activeSession(ctx)
  if (s?.step === 'amount') {
    // Accept "5" and also "5 coffee" here; the button already chose the type,
    // so a sign ("-5") is rejected rather than silently dropped
    const q = /^\s*[+-]/.test(text) ? null : parseQuickEntry(text)
    if (!q || !q.amount.ok) return ctx.send(ERRORS[q?.amount.error || 'invalid_amount'], kb.amounts(s.draft.type))
    if (!confirmMode(ctx)) return instantSave(ctx, s.draft.type, q.amount.value, q.rest)
    return q.rest ? quickAdd(ctx, s.draft.type, q.amount.value, q.rest) : afterAmount(ctx, { ...s.draft, amount: q.amount.value })
  }
  if (s?.step === 'note') {
    const d = cleanDescription(text)
    if (!d.ok) return ctx.send(ERRORS[d.error], kb.skipNote())
    return showConfirm(ctx, { ...s.draft, description: d.value })
  }

  // "5 coffee", "12.50 food lunch", "+100 salary"
  const quick = parseQuickEntry(text)
  if (quick) {
    if (!quick.amount.ok) return ctx.send(ERRORS[quick.amount.error])
    if (!confirmMode(ctx)) return instantSave(ctx, quick.type, quick.amount.value, quick.rest)
    return quickAdd(ctx, quick.type, quick.amount.value, quick.rest)
  }

  if (s?.step === 'category') return ctx.send('👆 Tap a category above, or ✖️ Cancel.')
  if (s?.step === 'confirm') return ctx.send('👆 Tap ✅ Save or ✖️ Cancel above.')
  return ctx.send('🤔 I didn\'t get that. Type an amount like <code>5 coffee</code>, or use the buttons below.', kb.mainKeyboard())
}

// ── Slash commands ────────────────────────────────────────────────────────────
async function runCommand(ctx, cmd, args) {
  if (cmd.startsWith('budget_') && cmd !== 'budget_remaining') return showBudget(ctx, { only: cmd.slice(7) })

  switch (cmd) {
    case 'start':
    case 'menu':
      await endSession(ctx)
      return ctx.send(`📋 <b>Smart Money Tracking</b>\n\n${welcomeText()}`, kb.mainKeyboard())
    case 'help': return ctx.send(HELP, kb.mainKeyboard())
    case 'balance': return showBalance(ctx)
    case 'income': return args ? quickAddArgs(ctx, 'income', args) : showSummary(ctx, 'income', 'month')
    case 'income_month': return showSummary(ctx, 'income', 'month')
    case 'income_today': return showSummary(ctx, 'income', 'today')
    case 'expense': return args ? quickAddArgs(ctx, 'expense', args) : showSummary(ctx, 'expense', 'month')
    case 'expense_month': return showSummary(ctx, 'expense', 'month')
    case 'expense_today': return showSummary(ctx, 'expense', 'today')
    case 'addincome': return args ? quickAddArgs(ctx, 'income', args) : beginAdd(ctx, 'income')
    case 'addexpense': return args ? quickAddArgs(ctx, 'expense', args) : beginAdd(ctx, 'expense')
    case 'add': return beginAdd(ctx)
    case 'transactions':
    case 'recent': return showRecent(ctx)
    case 'delete': return startDelete(ctx)
    case 'report': return showReport(ctx, 'month', ctx.today.slice(0, 7))
    case 'report_month':
      return showReport(ctx, 'month', MONTH_RE.test(args) ? args : ctx.today.slice(0, 7))
    case 'report_year':
      return showReport(ctx, 'year', /^\d{4}$/.test(args) ? args : ctx.today.slice(0, 4))
    case 'budget': return showBudget(ctx, args ? { only: slug(args) } : {})
    case 'budget_remaining': return showBudget(ctx, { remainingOnly: true })
    case 'settings': return showSettings(ctx)
    case 'cancel':
      await endSession(ctx)
      return ctx.send('Cancelled. Nothing was saved.', kb.mainKeyboard())
    case 'unlink':
      return ctx.send('Disconnect this Telegram account from Smart Money Tracking? Your data stays safe in the app.', kb.confirmUnlink())
    default:
      return ctx.send(`🤔 Unknown command /${esc(cmd)}. Try the buttons below or /help.`, kb.mainKeyboard())
  }
}

// ── Overview screens ──────────────────────────────────────────────────────────
async function showBalance(ctx) {
  const all = await ctx.data.allTransactions(ctx.uid)
  const t = totals(all)
  const month = ctx.today.slice(0, 7)
  const m = totals(all.filter((x) => x.date?.startsWith(month)))
  const c = ctx.currency
  return ctx.show(
    `💰 <b>Your balance</b>\n<b>${money(t.balance, c)}</b>\n\n` +
    `Total income   ${money(t.income, c)}\n` +
    `Total expenses ${money(t.expense, c)}\n` +
    (t.borrow || t.payback ? `Borrowed / repaid ${money(t.borrow, c)} / ${money(t.payback, c)}\n` : '') +
    `\n<b>${esc(monthTitle(month))}</b>\n` +
    `➕ ${money(m.income, c)}   ➖ ${money(m.expense, c)}   = <b>${signedMoney(m.balance, c)}</b>`,
    kb.balanceActions()
  )
}

async function showSummary(ctx, type, scope) {
  const range = scope === 'today'
    ? { start: ctx.today, end: ctx.today }
    : periodRange('month', Number(ctx.today.slice(0, 4)), Number(ctx.today.slice(5, 7)) - 1)
  const [txs, cats] = await Promise.all([
    ctx.data.transactionsBetween(ctx.uid, range.start, range.end),
    ctx.data.categories(ctx.uid),
  ])
  const rows = txs.filter((t) => t.type === type).sort(byDateDesc)
  const total = sumByType(rows, type)
  const title = `${type === 'income' ? '📥 <b>Income' : '📤 <b>Expenses'} · ${scope === 'today' ? 'Today' : esc(monthTitle(ctx.today.slice(0, 7)))}</b>`
  const body = rows.length
    ? `Total <b>${money(total, ctx.currency)}</b> · ${rows.length} item${rows.length === 1 ? '' : 's'}\n\n` +
      rows.slice(0, 10).map((t) => txLine(t, cats, ctx.currency)).join('\n') +
      (rows.length > 10 ? `\n…and ${rows.length - 10} more` : '')
    : 'Nothing recorded yet.'
  return ctx.show(`${title}\n${body}`, kb.summaryToggle(type, scope))
}

// ── Adding ────────────────────────────────────────────────────────────────────
const draftHeader = (d, currency) =>
  `${TYPE_ICON[d.type]} <b>New ${d.type}</b>` +
  (d.amount ? ` · ${money(d.amount, 'USD')}${currency === 'KHR' ? ` (≈ ${money(d.amount, 'KHR')})` : ''}` : '') +
  (d.categoryLabel ? ` · ${catEmoji(d.categoryIcon)} ${esc(d.categoryLabel)}` : '')

async function beginAdd(ctx, type) {
  if (!type) {
    await saveSession(ctx, { step: 'type' })
    return ctx.show('What would you like to add?', kb.chooseType())
  }
  const draft = { type }
  await saveSession(ctx, { step: 'amount', draft })
  const hint = confirmMode(ctx)
    ? 'How much? Type an amount or tap one:'
    : 'How much? Tap an amount or type one (e.g. <code>5 coffee</code>) — it\'s saved right away.'
  return ctx.show(`${draftHeader(draft, ctx.currency)}\n${hint}`, kb.amounts(type))
}

// ── Instant save (default) ────────────────────────────────────────────────────
/**
 * Save immediately with a smart category guess, then offer one-tap fixes.
 * The document id comes from the Telegram message / button press, so a
 * re-delivered update can never create a second transaction.
 */
async function instantSave(ctx, type, amount, words) {
  const [cats, history] = await Promise.all([
    ctx.data.categories(ctx.uid, type),
    ctx.data.historyForGuess(ctx.uid),
  ])
  if (!cats.length) return ctx.show(noCategoriesText(type))
  const g = guessCategory({ type, words, categories: cats, history })
  const note = cleanDescription(g.note)
  if (!note.ok) return ctx.send(ERRORS[note.error])

  const id = `tg_${ctx.sourceId}`
  const record = {
    type,
    amount: Number(amount),
    category: g.category.value,
    description: note.value,
    date: ctx.today,
    createdAt: new Date().toISOString(),
    source: 'telegram',
  }
  try {
    await ctx.data.createTransaction(ctx.uid, id, record)
  } catch (e) {
    if (!(e instanceof PreconditionError)) throw e
    // Same message delivered again → show what was already saved, don't save twice
    const existing = await ctx.data.getTransaction(ctx.uid, id)
    return showSaved(ctx, id, existing || record, cats, history, 'named')
  }
  if (ctx.session) await endSession(ctx) // a started guided add is now complete
  console.log(JSON.stringify({ event: 'transaction_saved', type, mode: 'instant', guess: g.how }))
  return showSaved(ctx, id, record, cats, history, g.how)
}

function showSaved(ctx, id, tx, cats, history, how) {
  const g = guessCategory({ type: tx.type, words: '', categories: cats, history })
  const cat = cats.find((c) => c.value === tx.category) || { ...categoryInfo(tx.category, tx.type, cats), value: tx.category }
  const alternatives = [cat, ...g.alternatives, g.category]
    .filter((c, i, arr) => c.value !== tx.category && c.id && arr.findIndex((x) => x.value === c.value) === i)
    .slice(0, 3)
  const when = tx.date === ctx.today ? 'today' : tx.date === dayBefore(ctx.today) ? 'yesterday' : longDate(tx.date)
  const hint = how && how !== 'named' ? '\n<i>Not the right category? Tap one below.</i>' : ''
  return ctx.show(
    `✅ <b>Saved</b> ${TYPE_ICON[tx.type]} <b>${money(tx.amount, ctx.currency)}</b>\n` +
    `${catEmoji(cat.icon)} ${esc(cat.label)}${tx.description ? ` · ${esc(tx.description)}` : ''} · ${when}${hint}`,
    kb.savedActions(id, alternatives, tx.date === ctx.today, tx.type)
  )
}

const BOT_TX_RE = /^tg_[A-Za-z0-9_-]{1,40}$/
const DOC_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

/** Load a bot-created transaction of THIS user plus what the "Saved" view needs. */
async function loadSaved(ctx, id) {
  const [tx, cats, history] = await Promise.all([
    ctx.data.getTransaction(ctx.uid, id),
    ctx.data.categories(ctx.uid),
    ctx.data.historyForGuess(ctx.uid),
  ])
  return { tx, cats: tx ? cats.filter((c) => c.type === tx.type) : [], history }
}

async function recategorizeSaved(ctx, id, catDocId) {
  const { tx, cats, history } = await loadSaved(ctx, id)
  if (!tx) return ctx.show('That transaction no longer exists.')
  const cat = cats.find((c) => c.id === catDocId)
  if (!cat) return ctx.show(ERRORS.session_expired)
  await ctx.data.patchTransaction(ctx.uid, id, { category: cat.value })
  return showSaved(ctx, id, { ...tx, category: cat.value }, cats, history, 'named')
}

async function toggleSavedDate(ctx, id) {
  const { tx, cats, history } = await loadSaved(ctx, id)
  if (!tx) return ctx.show('That transaction no longer exists.')
  const date = tx.date === ctx.today ? dayBefore(ctx.today) : ctx.today
  await ctx.data.patchTransaction(ctx.uid, id, { date })
  return showSaved(ctx, id, { ...tx, date }, cats, history, 'named')
}

/** Typed "AMOUNT [category] [note]" — straight to confirm when the category matches. */
async function quickAdd(ctx, type, amount, rest) {
  const cats = await ctx.data.categories(ctx.uid, type)
  if (!cats.length) return ctx.send(noCategoriesText(type))
  const hit = splitCategory(rest, cats)
  if (hit) {
    const d = cleanDescription(hit.rest)
    if (!d.ok) return ctx.send(ERRORS[d.error])
    return showConfirm(ctx, draftWith({ type, amount }, hit.category, d.value))
  }
  // No category matched → keep the words as the note and ask for the category
  const d = cleanDescription(rest)
  if (!d.ok) return ctx.send(ERRORS[d.error])
  return askCategory(ctx, { type, amount, description: d.value }, cats)
}

async function quickAddArgs(ctx, type, args) {
  if (!confirmMode(ctx)) {
    // The command already sets the type, so a sign here ("-5") is an invalid amount
    const q = /^\s*[+-]/.test(args) ? null : parseQuickEntry(args)
    if (!q || !q.amount.ok) {
      return ctx.send(`${ERRORS[q?.amount.error || 'invalid_amount']}\n\nExample: <code>/add${type} 5 Lunch</code> — or just type <code>5 lunch</code>`)
    }
    return instantSave(ctx, type, q.amount.value, q.rest)
  }
  const cats = await ctx.data.categories(ctx.uid, type)
  if (!cats.length) return ctx.send(noCategoriesText(type))
  const parsed = parseAddArgs(args, cats)
  if (parsed.ok) return showConfirm(ctx, draftWith({ type, amount: parsed.amount }, parsed.category, parsed.description))
  if (parsed.error === 'unknown_category' || parsed.error === 'missing_category') {
    // Friendly recovery: keep the amount, let them pick the category by tapping
    const note = parsed.error === 'unknown_category' ? args.split(/\s+/).slice(1).join(' ') : ''
    const d = cleanDescription(note)
    return askCategory(ctx, { type, amount: parsed.amount, description: d.ok ? d.value : '' }, cats,
      parsed.error === 'unknown_category' ? `❌ Unknown category “${esc(parsed.attempted)}”.\n` : '')
  }
  return ctx.send(`${ERRORS[parsed.error] || ERRORS.generic}\n\nExample: <code>/add${type} 5 ${esc(cats[0].label)} Lunch</code> — or just type <code>5 ${esc(cats[0].label.toLowerCase())}</code>`)
}

const draftWith = (draft, category, description) => ({
  ...draft,
  category: category.value,
  categoryLabel: category.label,
  categoryIcon: category.icon || '',
  description,
})

async function afterAmount(ctx, draft) {
  if (draft.category) return draft.description === undefined ? askNote(ctx, draft) : showConfirm(ctx, draft)
  return askCategory(ctx, draft)
}

async function askCategory(ctx, draft, cats, prefix = '') {
  const list = cats || await ctx.data.categories(ctx.uid, draft.type)
  if (!list.length) {
    await endSession(ctx)
    return ctx.show(noCategoriesText(draft.type))
  }
  const options = list.slice(0, 40).map((c) => ({ value: c.value, label: c.label, icon: c.icon || '' }))
  await saveSession(ctx, { step: 'category', draft, options })
  return ctx.show(`${prefix}${draftHeader(draft, ctx.currency)}\nWhich category?`, kb.categories(options))
}

async function askNote(ctx, draft) {
  await saveSession(ctx, { step: 'note', draft })
  return ctx.show(`${draftHeader(draft, ctx.currency)}\nAdd a short note (e.g. “Lunch”) — or tap Skip.`, kb.skipNote())
}

async function showConfirm(ctx, draft) {
  const d = { ...draft, date: draft.date || ctx.today }
  const nonce = randomToken(12)
  await saveSession(ctx, { step: 'confirm', nonce, draft: d })
  const when = d.date === ctx.today ? 'Today' : d.date === dayBefore(ctx.today) ? 'Yesterday' : longDate(d.date)
  return ctx.show(
    `<b>Save this ${d.type}?</b>\n\n` +
    `${TYPE_ICON[d.type]} <b>${money(d.amount, 'USD')}</b>${ctx.currency === 'KHR' ? ` (≈ ${money(d.amount, 'KHR')})` : ''}\n` +
    `${catEmoji(d.categoryIcon)} ${esc(d.categoryLabel)}\n` +
    `📝 ${d.description ? esc(d.description) : '<i>no note</i>'}\n` +
    `📅 ${when}`,
    kb.confirmSave(nonce, d.date === ctx.today)
  )
}

async function confirmSave(ctx, nonce) {
  const s = activeSession(ctx)
  if (!s || s.step !== 'confirm' || s.nonce !== nonce) {
    // Duplicate delivery / double tap of an already-saved confirmation?
    const saved = await ctx.data.getTransaction(ctx.uid, `tg_${nonce}`).catch(() => null)
    return ctx.show(saved ? '✅ Already saved.' : ERRORS.session_expired)
  }
  const d = s.draft
  // Exactly the app's transaction shape (+ `source` for traceability)
  const record = {
    type: d.type,
    amount: Number(d.amount),
    category: d.category,
    description: d.description || '',
    date: d.date || ctx.today,
    createdAt: new Date().toISOString(),
    source: 'telegram',
  }
  try {
    await ctx.data.saveConfirmedTransaction(ctx.tgId, ctx.uid, nonce, record)
  } catch (e) {
    if (e instanceof PreconditionError) return ctx.show('✅ Already saved.')
    throw e
  }
  ctx.session = null
  console.log(JSON.stringify({ event: 'transaction_saved', type: d.type }))
  return ctx.show(
    `✅ <b>Saved</b> — ${TYPE_LABEL[d.type].toLowerCase()} of <b>${money(d.amount, ctx.currency)}</b>\n` +
    `${catEmoji(d.categoryIcon)} ${esc(d.categoryLabel)}${d.description ? ` · ${esc(d.description)}` : ''} · ${record.date === ctx.today ? 'today' : longDate(record.date)}\n` +
    `<i>Already in your app.</i>`,
    kb.afterSave(`tg_${nonce}`, d.type)
  )
}

// ── History & deletion ────────────────────────────────────────────────────────
async function showRecent(ctx) {
  const [txs, cats] = await Promise.all([ctx.data.recentTransactions(ctx.uid, 10), ctx.data.categories(ctx.uid)])
  if (!txs.length) return ctx.show('🧾 No transactions yet.\nType an amount like <code>5 coffee</code> to add one.')
  return ctx.show(`🧾 <b>Latest ${txs.length}</b>\n\n${txs.map((t) => txLine(t, cats, ctx.currency)).join('\n')}`, kb.recentActions())
}

async function startDelete(ctx) {
  const [txs, cats] = await Promise.all([ctx.data.recentTransactions(ctx.uid, 10), ctx.data.categories(ctx.uid)])
  if (!txs.length) return ctx.show('There are no transactions to delete.')
  return ctx.show(
    '🗑 <b>Which one should I delete?</b>\nYou\'ll confirm on the next step.',
    kb.deletePicker(txs, (t) => `${t.date ? t.date.slice(5).replace('-', '/') : ''} · ${labelOf(t, cats)} · ${signFor(t)}${money(t.amount, ctx.currency)}`)
  )
}

async function askDelete(ctx, id) {
  const t = await ctx.data.getTransaction(ctx.uid, id) // only ever this user's collection
  if (!t) return ctx.show('That transaction no longer exists.')
  const cats = await ctx.data.categories(ctx.uid)
  return ctx.show(
    `🗑 <b>Delete this ${(TYPE_LABEL[t.type] || 'transaction').toLowerCase()}?</b>\n\n` +
    `${signFor(t)}<b>${money(t.amount, ctx.currency)}</b> · ${esc(labelOf(t, cats))}\n` +
    `📝 ${t.description ? esc(t.description) : '<i>no note</i>'}\n📅 ${t.date ? longDate(t.date) : '—'}\n\nThis can't be undone.`,
    kb.confirmDelete(id)
  )
}

async function doDelete(ctx, id, doneText) {
  try {
    await ctx.data.deleteTransaction(ctx.uid, id)
  } catch (e) {
    if (e instanceof PreconditionError) return ctx.show('That transaction was already deleted.')
    throw e
  }
  console.log(JSON.stringify({ event: 'transaction_deleted' }))
  return ctx.show(doneText || '🗑 Deleted — it\'s gone from the app too.', kb.recentActions())
}

// ── Reports & budgets ─────────────────────────────────────────────────────────
async function showReport(ctx, mode, key) {
  const y = Number(key.slice(0, 4))
  const m = mode === 'year' ? 1 : Number(key.slice(5, 7))
  const prev = mode === 'year' ? periodRange('year', y - 1, 0) : periodRange('month', m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2)
  const cur = periodRange(mode, y, m - 1)
  const [txs, cats] = await Promise.all([ctx.data.transactionsBetween(ctx.uid, prev.start, cur.end), ctx.data.categories(ctx.uid)])
  const r = periodReport(txs, mode, y, m - 1, ctx.today)
  const c = ctx.currency
  const prevName = mode === 'year' ? String(y - 1) : monthTitle(prev.start.slice(0, 7)).split(' ')[0]
  const trend = r.expenseChange === null
    ? `No ${esc(prevName)} expenses to compare.`
    : r.expenseChange === 0
      ? `Spending is the same as ${esc(prevName)}.`
      : `${r.expenseChange < 0 ? '📉' : '📈'} Spending ${r.expenseChange < 0 ? 'down' : 'up'} <b>${Math.abs(r.expenseChange)}%</b> vs ${esc(prevName)}`
  const top = r.topCategory
    ? (() => { const info = categoryInfo(r.topCategory.category, 'expense', cats); return `${catEmoji(info.icon)} ${esc(info.label)} · ${money(r.topCategory.amount, c)}` })()
    : '—'
  return ctx.show(
    `📊 <b>${mode === 'year' ? `Year ${y}` : esc(monthTitle(key))}</b>\n\n` +
    `➕ Income       ${money(r.income, c)}\n` +
    `➖ Expenses   ${money(r.expense, c)}\n` +
    `💰 Net savings <b>${signedMoney(r.net, c)}</b>\n` +
    `📈 Savings rate ${r.savingsRate === null ? '—' : r.savingsRate + '%'}\n\n` +
    `🏆 Top spending: ${top}\n` +
    `📆 Avg per day: ${r.avgDailySpend === null ? '—' : money(r.avgDailySpend, c)}\n` +
    `${trend}`,
    kb.reportNav(mode, mode === 'year' ? String(y) : key, mode === 'year' ? ctx.today.slice(0, 4) : ctx.today.slice(0, 7))
  )
}

async function showBudget(ctx, { only, remainingOnly } = {}) {
  const monthKey = ctx.today.slice(0, 7)
  const range = periodRange('month', Number(monthKey.slice(0, 4)), Number(monthKey.slice(5)) - 1)
  const [budgets, txs, cats] = await Promise.all([
    ctx.data.budgets(ctx.uid),
    ctx.data.transactionsBetween(ctx.uid, range.start, range.end),
    ctx.data.categories(ctx.uid),
  ])
  const u = budgetUsage(budgets, monthKey, txs)
  if (!u || (!u.total && !u.categories.length)) {
    return ctx.show(`🎯 No budget set for ${esc(monthTitle(monthKey))}.\nSet one in the app: <b>More → Budgets</b>.`)
  }
  const c = ctx.currency
  const bar = (pct) => {
    const filled = Math.max(0, Math.min(10, Math.round((pct || 0) / 10)))
    return `${pct >= 100 ? '🔴 ' : pct >= 80 ? '🟠 ' : ''}${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${pct}%`
  }
  const block = (title, x) => remainingOnly
    ? `${title}: <b>${x.remaining < 0 ? `over by ${money(-x.remaining, c)}` : `${money(x.remaining, c)} left`}</b>`
    : `<b>${title}</b>\n${bar(x.pct)}\n${money(x.spent, c)} of ${money(x.limit, c)} · ` +
      (x.remaining < 0 ? `<b>over by ${money(-x.remaining, c)}</b>` : `${money(x.remaining, c)} left`)

  let rows = u.categories.map((x) => {
    const info = categoryInfo(x.category, 'expense', cats)
    return { ...x, label: info.label, icon: info.icon }
  })
  if (only) {
    rows = rows.filter((x) => slug(x.label) === only || slug(x.category) === only || slug(x.label).startsWith(only))
    if (!rows.length) {
      const names = u.categories.map((x) => `/budget_${slug(categoryInfo(x.category, 'expense', cats).label) || slug(x.category)}`)
      return ctx.show(`No budget found for “${esc(only)}” this month.${names.length ? `\nTry: ${names.join(' ')}` : ''}`)
    }
  }
  const parts = [`🎯 <b>Budget · ${esc(monthTitle(monthKey))}</b>`]
  if (u.total && !only) parts.push(block('Monthly total', u.total))
  rows.forEach((x) => parts.push(block(`${catEmoji(x.icon)} ${esc(x.label)}`, x)))
  return ctx.show(parts.join('\n\n'), kb.budgetActions())
}

async function showSettings(ctx) {
  const s = ctx.settings
  const on = confirmMode(ctx)
  return ctx.show(
    `⚙️ <b>Settings</b>\n\nConnected as ${s.username ? '@' + esc(s.username) : esc(s.firstName || 'you')}\n` +
    `Currency: ${ctx.currency} · change it in the app\nTimezone: ${esc(s.timezone || ctx.env.DEFAULT_TIMEZONE || 'UTC')}\n\n` +
    `<b>Adding:</b> ${on ? '✅ asks you to confirm first' : '⚡ saves instantly (with Undo)'}\n\n` +
    `To disconnect: /unlink, or in the app: Settings → Telegram bot.`,
    kb.settingsActions(on)
  )
}

// ── Inline buttons ────────────────────────────────────────────────────────────
async function handleCallback(cq, deps) {
  deps.background(deps.tg.answer(cq.id)) // stop the button spinner without waiting
  const chatId = cq.message?.chat?.id
  const messageId = cq.message?.message_id
  if (!chatId || cq.message?.chat?.type !== 'private' || typeof cq.data !== 'string') return

  const user = await resolveUser(deps.fs, deps.env, cq.from.id)
  if (!user) return deps.tg.edit(chatId, messageId, NOT_LINKED)
  const ctx = makeCtx(deps, cq.from, chatId, user, messageId)
  // Button presses are idempotent per callback query (id kept to safe chars)
  ctx.sourceId = `q${String(cq.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30)}`
  const [action, value = ''] = cq.data.split(/:(.*)/s)
  const s = activeSession(ctx)

  switch (action) {
    case 'm': {
      const screens = {
        balance: () => showBalance(ctx),
        recent: () => showRecent(ctx),
        budget: () => showBudget(ctx),
        delete: () => startDelete(ctx),
        settings: () => showSettings(ctx),
        help: () => ctx.show(HELP, kb.back()),
        more: () => ctx.show('☰ <b>More</b>', kb.moreMenu()),
      }
      return screens[value]?.()
    }
    case 'sum': {
      const [type, scope] = value.split(':')
      if (!['income', 'expense'].includes(type) || !['today', 'month'].includes(scope)) return
      return showSummary(ctx, type, scope)
    }
    case 'rp': {
      const [mode, key] = value.split(':')
      if (mode === 'm') return showReport(ctx, 'month', key === 'now' ? ctx.today.slice(0, 7) : MONTH_RE.test(key) ? key : ctx.today.slice(0, 7))
      if (mode === 'y') return showReport(ctx, 'year', key === 'now' ? ctx.today.slice(0, 4) : /^\d{4}$/.test(key) ? key : ctx.today.slice(0, 4))
      return
    }
    case 'add':
      if (value !== 'income' && value !== 'expense') return
      return beginAdd(ctx, value)
    case 'amt': {
      if (s?.step !== 'amount') return ctx.show(ERRORS.session_expired)
      const a = parseAmount(value)
      if (!a.ok) return
      if (!confirmMode(ctx)) return instantSave(ctx, s.draft.type, a.value, '')
      return afterAmount(ctx, { ...s.draft, amount: a.value })
    }
    case 'rc': { // re-categorise a bot-saved transaction: rc:<txId>:<categoryDocId>
      const [id, catId] = value.split(':')
      if (!BOT_TX_RE.test(id || '') || !DOC_ID_RE.test(catId || '')) return
      return recategorizeSaved(ctx, id, catId)
    }
    case 'rcm': { // show every category for a saved transaction
      if (!BOT_TX_RE.test(value)) return
      const { tx, cats } = await loadSaved(ctx, value)
      if (!tx) return ctx.show('That transaction no longer exists.')
      return ctx.show(`Pick the right category for <b>${money(tx.amount, ctx.currency)}</b>:`, kb.recategorize(value, cats))
    }
    case 'rv': { // back to the "Saved" view
      if (!BOT_TX_RE.test(value)) return
      const { tx, cats, history } = await loadSaved(ctx, value)
      if (!tx) return ctx.show('That transaction no longer exists.')
      return showSaved(ctx, value, tx, cats, history, 'named')
    }
    case 'ry':
      if (!BOT_TX_RE.test(value)) return
      return toggleSavedDate(ctx, value)
    case 'cfm':
      if (value !== 'on' && value !== 'off') return
      await ctx.data.patchTelegramSettings(ctx.uid, { confirmBeforeSave: value === 'on' })
      ctx.settings = { ...ctx.settings, confirmBeforeSave: value === 'on' }
      return showSettings(ctx)
    case 'cat': {
      const opt = s?.options?.[Number(value)]
      if (s?.step !== 'category' || !opt) return ctx.show(ERRORS.session_expired)
      const draft = draftWith(s.draft, opt, s.draft.description)
      return draft.description === undefined ? askNote(ctx, draft) : showConfirm(ctx, draft)
    }
    case 'skip':
      if (s?.step !== 'note') return ctx.show(ERRORS.session_expired)
      return showConfirm(ctx, { ...s.draft, description: '' })
    case 'dt':
      if (s?.step !== 'confirm' || s.nonce !== value) return ctx.show(ERRORS.session_expired)
      return showConfirm(ctx, { ...s.draft, date: s.draft.date === ctx.today ? dayBefore(ctx.today) : ctx.today })
    case 'chg':
      if (s?.step !== 'confirm' || s.nonce !== value) return ctx.show(ERRORS.session_expired)
      return askCategory(ctx, { ...s.draft, category: undefined, categoryLabel: undefined, categoryIcon: undefined })
    case 'ok': return confirmSave(ctx, value)
    case 'no':
    case 'cancel':
      await endSession(ctx)
      return ctx.show('Cancelled — nothing was saved.')
    case 'undo':
      // Only transactions the bot created (tg_…) and only in this user's collection
      if (!BOT_TX_RE.test(value)) return
      return doDelete(ctx, value, '↩️ Undone — removed from the app.')
    case 'del':
      if (!TX_ID_RE.test(value)) return
      return askDelete(ctx, value)
    case 'delok':
      if (!TX_ID_RE.test(value)) return
      return doDelete(ctx, value)
    case 'unlink':
      if (value !== 'yes') return
      await unlink(ctx.fs, ctx.tgId, ctx.uid)
      console.log(JSON.stringify({ event: 'account_unlinked' }))
      return ctx.show('👋 Disconnected. Your data is still safe in the app. Reconnect any time from Settings → Telegram bot.')
    default:
      return undefined
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
const signFor = (t) => (t.type === 'income' || t.type === 'borrow' ? '+' : '−')

const labelOf = (t, cats) =>
  t.type === 'borrow' || t.type === 'payback' ? (t.name || TYPE_LABEL[t.type]) : categoryInfo(t.category, t.type, cats).label

function txLine(t, cats, currency) {
  const info = t.type === 'income' || t.type === 'expense' ? categoryInfo(t.category, t.type, cats) : { icon: '' }
  const emoji = t.type === 'borrow' || t.type === 'payback' ? TYPE_ICON[t.type] : catEmoji(info.icon)
  const note = t.description ? ` · ${esc(t.description.slice(0, 32))}` : ''
  const day = t.date ? `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}` : ''
  return `${emoji} <b>${signFor(t)}${money(t.amount, currency)}</b>  ${esc(labelOf(t, cats))}${note} <i>${day}</i>`
}

const noCategoriesText = (type) =>
  `You don't have any ${type} categories yet.\nCreate them in the app: <b>More → Categories</b>, then try again.`
