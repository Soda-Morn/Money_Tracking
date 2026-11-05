/**
 * Expense Planner in Telegram — same data and rules as the app
 * (src/shared/planner.js + users/{uid}/plannedExpenses, plannerMonths, plannedSeries).
 *
 * Safety (identical to the app):
 *  - plans never touch real transactions until a payment is CONFIRMED
 *  - paying creates transactions/plan_<id> create-only in ONE atomic commit
 *    with the plan update → the app and the bot can never both pay a plan
 *  - every id in a button is only ever looked up in the verified user's data
 *
 * UX:
 *  - Add:  type "120 Rent 10" → pick the category (best guess first, ✓) → saved
 *  - Pay:  tap a plan → 💳 Pay → payment screen (amount + date, nothing saved
 *          yet) → ✅ Confirm. "Different amount" / "Paid yesterday" are one tap.
 */
import {
  monthSummary, displayStatus, sortPlans, addMonths, occurrencesInMonth, occurrenceId,
} from '../../../src/shared/planner.js'
import { daysInMonth, toDateString } from '../../../src/shared/finance.js'
import { categoryInfo } from '../../../src/shared/categories.js'
import { PreconditionError } from '../firebase/client.js'
import { parseAmount } from '../security/validation.js'
import { guessCategory } from './guess.js'
import { afterExpense } from './limits.js'
import { esc, money, monthTitle, shortMonth, catEmoji, dayBefore, ERRORS } from './messages.js'

export const PLAN_ID_RE = /^[A-Za-z0-9_-]{1,58}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const SESSION_MS = 10 * 60 * 1000
const btn = (text, data) => ({ text, callback_data: data })
const rows = (buttons, perRow) => {
  const out = []
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow))
  return out
}

const dayLabel = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const STATUS = { pending: '⏳ Pending', overdue: '⚠️ Overdue', paid: '✅ Paid', cancelled: '⊘ Cancelled' }
const backTo = (month) => ({ inline_keyboard: [[btn('🗓 Back to plan', `pl:${month}`)]] })

// Conversation state lives in telegramSessions/{tgId} (same as quick add)
async function saveSession(ctx, fields) {
  const s = { ...fields, expiresAt: new Date(Date.now() + SESSION_MS) }
  ctx.session = s
  await ctx.data.setSession(ctx.tgId, s)
}
const liveSession = (ctx, step) => {
  const s = ctx.session
  return s && s.step === step && s.expiresAt && Date.parse(s.expiresAt) > Date.now() ? s : null
}
const endSession = async (ctx) => { ctx.session = null; await ctx.data.clearSession(ctx.tgId).catch(() => {}) }

/** Load a month (and create any missing recurring occurrences, like the app does). */
async function loadMonth(ctx, month) {
  const [plans, monthDoc, series, cats] = await Promise.all([
    ctx.data.plansInMonth(ctx.uid, month),
    ctx.data.plannerMonth(ctx.uid, month),
    ctx.data.plannerSeries(ctx.uid),
    ctx.data.categories(ctx.uid, 'expense'),
  ])
  if (month <= addMonths(ctx.today.slice(0, 7), 24)) {
    const have = new Set(plans.map((p) => p.id))
    for (const s of series.filter((x) => x.active)) {
      for (const dueDate of occurrencesInMonth(s, month)) {
        const id = occurrenceId(s.id, dueDate)
        if (have.has(id)) continue
        const doc = {
          name: s.name, amount: Number(s.amount), category: s.category, description: s.description || '',
          month, dueDate, status: 'pending', seriesId: s.id, frequency: s.frequency,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        try {
          await ctx.data.createPlan(ctx.uid, id, doc)
          plans.push({ id, ...doc })
        } catch (e) {
          if (!(e instanceof PreconditionError)) throw e // created meanwhile by the app → fine
        }
        have.add(id)
      }
    }
  }
  return { plans, monthDoc, cats }
}

// ── Month overview ────────────────────────────────────────────────────────────
export async function showPlan(ctx, month = ctx.today.slice(0, 7)) {
  if (!MONTH_RE.test(month)) month = ctx.today.slice(0, 7)
  const { plans, monthDoc, cats } = await loadMonth(ctx, month)
  const c = ctx.currency
  const s = monthSummary(plans, monthDoc, ctx.today)
  const open = sortPlans(plans.filter((p) => p.status === 'pending'), ctx.today)

  const lines = [`🗓 <b>Plan · ${esc(monthTitle(month))}</b>`, '']
  if (!plans.length && !s.expectedIncome) {
    lines.push('Nothing planned yet for this month.', '', 'Tap <b>➕ Plan expense</b> to add one.')
  } else {
    lines.push(
      `Expected income   ${money(s.expectedIncome, c)}`,
      `Planned expenses  ${money(s.plannedExpenses, c)}`,
      `Planned savings   ${money(s.plannedSavings, c)}`,
      s.expectedIncome
        ? `<b>Estimated remaining ${s.remaining < 0 ? '−' : ''}${money(Math.abs(s.remaining), c)}</b>${s.remaining < 0 ? ' ⚠️' : ''}`
        : '<i>Add expected income in the app to see what\'s left.</i>',
    )
    if (open.length) {
      lines.push('', `⏳ <b>Still to pay · ${money(s.stillToPay, c)}</b>`, '<i>Tap one below to pay it.</i>')
    } else if (plans.length) {
      lines.push('', '🎉 Nothing left to pay this month.')
    }
    const done = [s.count.paid && `✅ Paid ${s.count.paid}`, s.count.cancelled && `⊘ Cancelled ${s.count.cancelled}`].filter(Boolean)
    if (done.length) lines.push(done.join(' · '))
  }

  // One button per plan still to pay: icon · name · amount · due
  const itemButtons = open.slice(0, 10)
    .filter((p) => PLAN_ID_RE.test(p.id))
    .map((p) => {
      const late = displayStatus(p, ctx.today) === 'overdue'
      const icon = late ? '⚠️' : catEmoji(categoryInfo(p.category, 'expense', cats).icon)
      return [btn(`${icon} ${p.name} · ${money(p.amount, c)} · ${dayLabel(p.dueDate)}`.slice(0, 60), `pi:${p.id}`)]
    })
  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  return ctx.show(lines.join('\n'), {
    inline_keyboard: [
      ...itemButtons,
      ...(open.length > 10 ? [[btn(`…${open.length - 10} more in the app`, `pl:${month}`)]] : []),
      [btn('➕ Plan expense', `pa:${month}`)],
      [btn(`◀ ${shortMonth(prev)}`, `pl:${prev}`), btn(`${shortMonth(next)} ▶`, `pl:${next}`)],
    ],
  })
}

// ── One plan ──────────────────────────────────────────────────────────────────
async function loadPlan(ctx, id) {
  if (!PLAN_ID_RE.test(id || '')) return null
  const [plan, cats] = await Promise.all([ctx.data.getPlan(ctx.uid, id), ctx.data.categories(ctx.uid, 'expense')])
  return plan ? { plan: { ...plan, id }, cats } : null
}

export async function showPlanItem(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan: p, cats } = found
  const info = categoryInfo(p.category, 'expense', cats)
  const st = displayStatus(p, ctx.today)
  const text = [
    `<b>${esc(p.name)}</b>`,
    `${money(p.amount, ctx.currency)} · ${catEmoji(info.icon)} ${esc(info.label)}`,
    `Due ${dayLabel(p.dueDate)} · ${STATUS[st]}${p.seriesId ? ' · 🔁 repeats' : ''}`,
    p.description ? `📝 ${esc(p.description)}` : '',
    st === 'paid' ? `Paid ${money(p.actualAmount ?? p.amount, ctx.currency)} on ${dayLabel(p.paidAt || p.dueDate)}` : '',
  ].filter(Boolean).join('\n')
  const kb = []
  if (p.status === 'pending') {
    kb.push([btn(`💳 Pay · ${money(p.amount, 'USD')}`, `pp:${p.id}`)])
    kb.push([btn('🏷 Change category', `prcm:${p.id}`), btn('⊘ Cancel plan', `pc:${p.id}`)])
  } else if (p.status === 'paid') {
    kb.push([btn('↩️ Undo payment', `pu:${p.id}`)])
  } else if (p.status === 'cancelled') {
    kb.push([btn('↺ Restore', `prs:${p.id}`)])
  }
  kb.push([btn('◀ Back to plan', `pl:${p.month}`)])
  return ctx.show(text, { inline_keyboard: kb })
}

// ── Paying: a payment screen first, saved only on ✅ Confirm ──────────────────
function payScreen(ctx, plan, s) {
  const c = ctx.currency
  const diff = Number(plan.amount) - Number(s.amount)
  const when = s.date === ctx.today ? 'Today' : s.date === dayBefore(ctx.today) ? 'Yesterday' : dayLabel(s.date)
  const note = diff > 0 ? ` <i>(${money(diff, c)} less than planned)</i>` : diff < 0 ? ` <i>(${money(-diff, c)} more than planned)</i>` : ''
  return ctx.show(
    `💳 <b>Pay ${esc(plan.name)}</b>\n\n` +
    `Planned  ${money(plan.amount, c)}\n` +
    `Paying   <b>${money(s.amount, c)}</b>${note}\n` +
    `Date     ${when}\n\n` +
    '<i>Confirming adds this expense to your transactions and balance.</i>',
    {
      inline_keyboard: [
        [btn(`✅ Confirm payment · ${money(s.amount, 'USD')}`, `ppc:${plan.id}`)],
        [btn('✏️ Different amount', `ppa:${plan.id}`), btn(s.date === ctx.today ? '📅 Paid yesterday' : '📅 Paid today', `ppd:${plan.id}`)],
        [btn('◀ Back', `pi:${plan.id}`)],
      ],
    }
  )
}

/** Open the payment screen (nothing is saved yet). */
export async function startPay(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan } = found
  if (plan.status === 'paid') return ctx.show('✅ This plan was already paid.', backTo(plan.month))
  if (plan.status !== 'pending') return ctx.show('This plan isn\'t pending any more.', backTo(plan.month))
  const s = { step: 'pay', planId: plan.id, amount: Number(plan.amount), date: ctx.today }
  await saveSession(ctx, s)
  return payScreen(ctx, plan, s)
}

/** The payment state for THIS plan, or null if it expired / belongs to another plan. */
function payState(ctx, id) {
  const s = liveSession(ctx, 'pay') || liveSession(ctx, 'pay_amount')
  return s && s.planId === id ? s : null
}

export async function askPayAmount(ctx, id) {
  const s = payState(ctx, id)
  if (!s) return startPay(ctx, id)
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  await saveSession(ctx, { ...s, step: 'pay_amount' })
  return ctx.show(
    `✏️ How much did you actually pay for <b>${esc(found.plan.name)}</b>?\n` +
    `Planned ${money(found.plan.amount, ctx.currency)} — type the amount, e.g. <code>110</code>`,
    { inline_keyboard: [[btn('◀ Back to payment', `ppb:${id}`)]] }
  )
}

/** Typed amount while on the "different amount" step. */
export async function receivePayAmount(ctx, text) {
  const s = liveSession(ctx, 'pay_amount')
  if (!s) return ctx.send(ERRORS.session_expired)
  const a = parseAmount(String(text).replace(/^\$/, ''))
  if (!a.ok) return ctx.send(ERRORS[a.error])
  const found = await loadPlan(ctx, s.planId)
  if (!found) return ctx.send('That plan no longer exists.')
  const next = { ...s, step: 'pay', amount: a.value }
  await saveSession(ctx, next)
  return payScreen(ctx, found.plan, next)
}

/** Back from "different amount" without changing anything. */
export async function backToPay(ctx, id) {
  const s = payState(ctx, id)
  if (!s) return startPay(ctx, id)
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const next = { ...s, step: 'pay' }
  await saveSession(ctx, next)
  return payScreen(ctx, found.plan, next)
}

export async function togglePayDate(ctx, id) {
  const s = payState(ctx, id)
  if (!s) return startPay(ctx, id)
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const next = { ...s, step: 'pay', date: s.date === ctx.today ? dayBefore(ctx.today) : ctx.today }
  await saveSession(ctx, next)
  return payScreen(ctx, found.plan, next)
}

/** ✅ Confirm: one atomic write; a double tap / re-delivery can't pay twice. */
export async function confirmPay(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan } = found
  if (plan.status === 'paid') return ctx.show('✅ This plan was already paid.', backTo(plan.month))
  if (plan.status !== 'pending') return ctx.show('This plan isn\'t pending any more.', backTo(plan.month))
  const s = payState(ctx, id)
  if (!s) return ctx.show(`${ERRORS.session_expired}`, { inline_keyboard: [[btn('💳 Start again', `pp:${id}`)]] })
  try {
    await ctx.data.payPlan(ctx.uid, plan, { paidDate: s.date, actualAmount: s.amount, createdAt: new Date().toISOString() })
  } catch (e) {
    if (e instanceof PreconditionError) return ctx.show('✅ This plan was already paid.', backTo(plan.month))
    throw e
  }
  await endSession(ctx)
  console.log(JSON.stringify({ event: 'plan_paid' }))
  const diff = Number(plan.amount) - Number(s.amount)
  // Daily / weekly limit status (and any alert this payment triggers)
  const [limitsDoc, cats] = await Promise.all([ctx.data.spendingLimits(ctx.uid), ctx.data.categories(ctx.uid, 'expense')])
  const limitText = await afterExpense(ctx, { type: 'expense', category: plan.category }, cats, limitsDoc).catch(() => '')
  return ctx.show(
    `✅ <b>Paid</b> — ${esc(plan.name)} · ${money(s.amount, ctx.currency)}` +
    (diff ? ` <i>(planned ${money(plan.amount, ctx.currency)})</i>` : '') +
    `\n<i>Added to your transactions and balance.</i>${limitText}`,
    { inline_keyboard: [[btn('↩️ Undo payment', `pu:${plan.id}`), btn('🗓 Back to plan', `pl:${plan.month}`)]] }
  )
}

export async function undoPlanPayment(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan } = found
  if (plan.status !== 'paid') return ctx.show('This plan isn\'t paid.', backTo(plan.month))
  await ctx.data.undoPlanPayment(ctx.uid, plan, new Date().toISOString())
  console.log(JSON.stringify({ event: 'plan_payment_undone' }))
  return ctx.show(`↩️ Payment undone — <b>${esc(plan.name)}</b> is pending again and the expense was removed.`, backTo(plan.month))
}

// ── Cancel / restore ──────────────────────────────────────────────────────────
export async function askCancelPlan(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  return ctx.show(
    `Cancel “<b>${esc(found.plan.name)}</b>”?\nIt won't count in this month's plan. You can restore it later.`,
    { inline_keyboard: [[btn('⊘ Yes, cancel', `pcy:${id}`), btn('Keep it', `pi:${id}`)]] }
  )
}

export async function setPlanStatus(ctx, id, status) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan } = found
  if (plan.status === 'paid') return ctx.show('Paid plans can\'t be changed here — undo the payment first.', backTo(plan.month))
  const fields = status === 'cancelled'
    ? { status: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    : { status: 'pending', cancelledAt: undefined, updatedAt: new Date().toISOString() }
  await ctx.data.patchPlan(ctx.uid, id, fields)
  return ctx.show(status === 'cancelled' ? `⊘ Cancelled — ${esc(plan.name)}` : `↺ Restored — ${esc(plan.name)}`, backTo(plan.month))
}

// ── Adding: type "120 Rent 10" → choose category → saved ──────────────────────
/** "120 Rent 10" → { amount, name, day } ; day optional (1–31). */
export function parsePlanText(text) {
  const m = String(text || '').trim().match(/^\$?(\d[\d,]*(?:\.\d{1,2})?)\s+(.+?)(?:\s+(\d{1,2}))?$/s)
  if (!m) return { ok: false, error: 'format' }
  const amount = Number(m[1].replace(/,/g, ''))
  if (!(amount > 0) || amount > 1e9) return { ok: false, error: 'amount' }
  const name = m[2].replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'format' }
  if (name.length > 60) return { ok: false, error: 'name' }
  return { ok: true, amount, name, day: m[3] ? Number(m[3]) : null }
}

const PLAN_HELP = 'Type the amount, a name and (optionally) the due day — for example:\n<code>120 Rent 10</code>  ·  <code>15 Internet 6</code>  ·  <code>100 Food</code>'

export async function askPlanText(ctx, month) {
  if (!MONTH_RE.test(month)) month = ctx.today.slice(0, 7)
  await saveSession(ctx, { step: 'plan_text', month })
  return ctx.show(`➕ <b>Plan an expense · ${esc(monthTitle(month))}</b>\n${PLAN_HELP}\n\nNext you'll choose the category.`, backTo(month))
}

/** Parse the typed plan, then ask for the category (best guess first). */
export async function addPlan(ctx, month, text) {
  const parsed = parsePlanText(text)
  if (!parsed.ok) {
    const msg = { amount: ERRORS.invalid_amount, name: '❌ Keep the name under 60 characters.' }[parsed.error] || `❌ I couldn't read that.\n${PLAN_HELP}`
    return ctx.send(msg)
  }
  const [y, m] = month.split('-').map(Number)
  const last = daysInMonth(y, m - 1)
  const defaultDay = month === ctx.today.slice(0, 7) ? Number(ctx.today.slice(8, 10)) : 1
  const day = parsed.day ?? defaultDay
  if (day < 1 || day > last) return ctx.send(`❌ ${esc(monthTitle(month))} has ${last} days — pick a due day from 1 to ${last}.`)

  const [cats, history] = await Promise.all([ctx.data.categories(ctx.uid, 'expense'), ctx.data.historyForGuess(ctx.uid)])
  if (!cats.length) return ctx.send('You don\'t have any expense categories yet.\nCreate them in the app: <b>More → Categories</b>.')
  const g = guessCategory({ type: 'expense', words: parsed.name, categories: cats, history })
  // Best guess first, then the rest in the user's own order
  const ordered = [g.category, ...cats.filter((c) => c.value !== g.category.value)].slice(0, 30)
  const options = ordered.map((c) => ({ value: c.value, label: c.label, icon: c.icon || '' }))

  const draft = { month, name: parsed.name, amount: parsed.amount, dueDate: toDateString(y, m - 1, day), sourceId: ctx.sourceId }
  await saveSession(ctx, { step: 'plan_cat', draft, options })
  return ctx.send(
    `🗓 <b>${esc(draft.name)}</b> · ${money(draft.amount, ctx.currency)} · due ${dayLabel(draft.dueDate)}\n` +
    '🏷 <b>Which category?</b> <i>(✓ = suggested)</i>',
    {
      inline_keyboard: [
        ...rows(options.map((c, i) => btn(`${i === 0 ? '✓ ' : ''}${catEmoji(c.icon)} ${c.label}`.slice(0, 32), `pcat:${i}`)), 2),
        [btn('✖️ Cancel', 'cancel')],
      ],
    }
  )
}

/** Category tapped → save the plan (idempotent per original Telegram message). */
export async function pickPlanCategory(ctx, index) {
  const s = liveSession(ctx, 'plan_cat')
  const opt = s?.options?.[Number(index)]
  if (!s || !opt) return ctx.show(ERRORS.session_expired)
  const d = s.draft
  const id = `tgp_${d.sourceId}`
  const now = new Date().toISOString()
  const plan = {
    name: d.name, amount: Number(d.amount), category: opt.value, description: '',
    month: d.month, dueDate: d.dueDate, status: 'pending', createdAt: now, updatedAt: now, source: 'telegram',
  }
  try {
    await ctx.data.createPlan(ctx.uid, id, plan)
  } catch (e) {
    if (!(e instanceof PreconditionError)) throw e // same message delivered twice → already saved
  }
  await endSession(ctx)
  console.log(JSON.stringify({ event: 'plan_added' }))
  // categoryInfo() only matches categories of the right type → tag it
  return showSavedPlan(ctx, { id, ...plan }, [{ ...opt, type: 'expense' }])
}

function showSavedPlan(ctx, plan, cats) {
  const info = categoryInfo(plan.category, 'expense', cats)
  return ctx.show(
    `🗓 <b>Planned</b> — ${esc(plan.name)} · ${money(plan.amount, ctx.currency)}\n` +
    `${catEmoji(info.icon)} ${esc(info.label)} · due ${dayLabel(plan.dueDate)} (${esc(monthTitle(plan.month))})\n` +
    '<i>Only a plan — your balance doesn\'t change until you pay it.</i>',
    {
      inline_keyboard: [
        [btn('🏷 Change category', `prcm:${plan.id}`), btn('↩️ Undo', `pd:${plan.id}`)],
        [btn('➕ Plan another', `pa:${plan.month}`), btn('🗓 View plan', `pl:${plan.month}`)],
      ],
    }
  )
}

// ── Change category of an existing (pending) plan ────────────────────────────
export async function chooseNewCategory(ctx, id) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan, cats } = found
  if (plan.status !== 'pending') return ctx.show('Only pending plans can change category.', backTo(plan.month))
  return ctx.show(
    `🏷 New category for <b>${esc(plan.name)}</b>:`,
    {
      inline_keyboard: [
        ...rows(cats.slice(0, 30).filter((c) => c.id).map((c) => btn(`${c.value === plan.category ? '✓ ' : ''}${catEmoji(c.icon)} ${c.label}`.slice(0, 32), `prc:${id}:${c.id}`)), 2),
        [btn('◀ Back', `pi:${id}`)],
      ],
    }
  )
}

export async function recategorizePlan(ctx, id, catDocId) {
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan no longer exists.')
  const { plan, cats } = found
  const cat = cats.find((c) => c.id === catDocId)
  if (!cat || plan.status !== 'pending') return ctx.show(ERRORS.session_expired)
  await ctx.data.patchPlan(ctx.uid, id, { category: cat.value, updatedAt: new Date().toISOString() })
  return showSavedPlan(ctx, { ...plan, category: cat.value }, cats)
}

/** Undo a plan just added from Telegram (only tgp_ ids, only if still pending). */
export async function undoAddPlan(ctx, id) {
  if (!/^tgp_[A-Za-z0-9_-]{1,50}$/.test(id)) return undefined
  const found = await loadPlan(ctx, id)
  if (!found) return ctx.show('That plan was already removed.')
  if (found.plan.status !== 'pending') return ctx.show('That plan was already paid or cancelled — manage it from the plan.', backTo(found.plan.month))
  await ctx.data.deletePlan(ctx.uid, id).catch((e) => { if (!(e instanceof PreconditionError)) throw e })
  return ctx.show(`↩️ Removed — ${esc(found.plan.name)}`, backTo(found.plan.month))
}
