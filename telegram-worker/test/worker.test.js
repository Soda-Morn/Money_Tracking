// End-to-end tests: real Worker fetch handler ⇄ in-memory Google/Firestore/Telegram.
// Run: npm test   (node --test, no extra dependencies)
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { makeServiceAccount, installFakes } from './fakes.js'
import { sha256Hex, hmacHex } from '../src/security/crypto.js'
import { _resetTokenCache } from '../src/firebase/auth.js'
import { _clearLinkCache } from '../src/security/linking.js'
import { _resetCommandRegistration } from '../src/telegram/commands.js'
import { todayIn, dayBefore } from '../src/telegram/messages.js'
import { KEYS } from '../src/telegram/keyboards.js'
import worker from '../src/index.js'
import { createFirestore, PreconditionError } from '../src/firebase/client.js'
import { createData } from '../src/firebase/data.js'

const TZ = 'Asia/Phnom_Penh'
let env, fx, sa
let updateId = 1000

before(async () => { sa = await makeServiceAccount() })

beforeEach(() => {
  _resetTokenCache()
  _clearLinkCache()
  _resetCommandRegistration()
  env = {
    TELEGRAM_BOT_TOKEN: '123:test-token',
    TELEGRAM_WEBHOOK_SECRET: 'whsec_test_0123456789',
    LINK_SIGNING_KEY: 'link-signing-key-for-tests',
    FIREBASE_PROJECT_ID: 'demo-project',
    FIREBASE_CLIENT_EMAIL: 'bot@demo-project.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: sa.pem,
    DEFAULT_TIMEZONE: TZ,
  }
  fx = installFakes({ projectId: env.FIREBASE_PROJECT_ID, publicKey: sa.publicKey, clientEmail: env.FIREBASE_CLIENT_EMAIL })
})

// ── helpers ───────────────────────────────────────────────────────────────────
/** POST an update; a reply returned in the webhook response counts as a Bot API call. */
async function post(update, secret = env.TELEGRAM_WEBHOOK_SECRET) {
  const res = await worker.fetch(new Request('https://bot.example/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}) },
    body: JSON.stringify(update),
  }), env)
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const { method, ...body } = await res.clone().json()
    fx.telegram.push({ method, body, viaWebhookResponse: true })
  }
  return res
}

const msg = (fromId, text, chatType = 'private') => ({
  update_id: ++updateId,
  message: { message_id: updateId, from: { id: fromId, first_name: 'Test', username: `user${fromId}` }, chat: { id: fromId, type: chatType }, text },
})
const cb = (fromId, data) => ({
  update_id: ++updateId,
  callback_query: { id: `cq${updateId}`, from: { id: fromId }, data, message: { message_id: 55, chat: { id: fromId, type: 'private' } } },
})
const say = async (fromId, text) => { await post(msg(fromId, text)); return fx.lastText() }
const tap = async (fromId, data) => { await post(cb(fromId, data)); return fx.lastText() }
const buttons = () => fx.lastMarkup().flat()
const button = (pred) => buttons().find((b) => (typeof pred === 'string' ? b.text.includes(pred) : pred(b)))

/** What the Vue app does: random code, store only its SHA-256 hash with an expiry. */
async function createLinkCode(uid, { ttlMs = 5 * 60_000, timezone = TZ } = {}) {
  const code = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  fx.seed(`telegramLinkCodes/${await sha256Hex(code)}`, { uid, expiresAt: new Date(Date.now() + ttlMs), createdAt: new Date(), timezone })
  return code
}
async function link(fromId, uid, { confirm = false } = {}) {
  const code = await createLinkCode(uid)
  assert.match(await say(fromId, `/start ${code}`), /Connected/)
  // Confirm-before-saving is a per-user setting (default: instant save)
  if (confirm) fx.seed(`users/${uid}/settings/telegram`, { ...fx.read(`users/${uid}/settings/telegram`), confirmBeforeSave: true })
}

const today = () => todayIn(TZ)
const monthKey = () => today().slice(0, 7)
const prevMonthKey = () => {
  const [y, m] = monthKey().split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** A user whose data looks exactly like what the Vue app writes. */
function seedUser(uid) {
  fx.seed(`users/${uid}/categories/c1`, { type: 'expense', label: 'Food', icon: 'utensils', value: 'food_1' })
  fx.seed(`users/${uid}/categories/c2`, { type: 'expense', label: 'Food & Dining Out', icon: 'pizza', value: 'dining_2' })
  fx.seed(`users/${uid}/categories/c3`, { type: 'expense', label: 'Transport', icon: 'car', value: 'transport_3' })
  fx.seed(`users/${uid}/categories/c4`, { type: 'income', label: 'Salary', icon: 'briefcase', value: 'salary_4' })
  const m = monthKey(); const p = prevMonthKey()
  fx.seed(`users/${uid}/transactions/a1`, { type: 'income', amount: 2500, category: 'salary_4', description: 'Pay', date: `${m}-01`, createdAt: '2026-01-01T00:00:00Z' })
  fx.seed(`users/${uid}/transactions/a2`, { type: 'expense', amount: 700, category: 'food_1', description: '', date: `${m}-01`, createdAt: '2026-01-01T00:00:01Z' })
  fx.seed(`users/${uid}/transactions/a3`, { type: 'expense', amount: 500, category: 'transport_3', description: 'Taxi', date: `${m}-01`, createdAt: '2026-01-01T00:00:02Z' })
  fx.seed(`users/${uid}/transactions/a4`, { type: 'expense', amount: 1000, category: 'food_1', description: '', date: `${p}-10`, createdAt: '2026-01-01T00:00:03Z' })
  fx.seed(`users/${uid}/transactions/a5`, { type: 'borrow', amount: 300, name: 'Nary', description: '', date: `${m}-01`, createdAt: '2026-01-01T00:00:04Z' })
  fx.seed(`users/${uid}/settings/budgets`, { [m]: { total: 2000, categories: { food_1: 1000 } } })
}

const confirmNonce = () => button((b) => b.callback_data?.startsWith('ok:'))?.callback_data.slice(3)
const txCount = (uid) => fx.docsUnder(`users/${uid}/transactions`).length

// ── 0. Webhook authentication ─────────────────────────────────────────────────
test('rejects requests without the webhook secret', async () => {
  assert.equal((await post(msg(1, '/help'), null)).status, 401)
  assert.equal((await post(msg(1, '/help'), 'wrong-secret')).status, 401)
  assert.equal(fx.telegram.length, 0)
})

// ── 1–3. Linking ──────────────────────────────────────────────────────────────
test('1. links a Telegram account with a valid one-time code and shows the keyboard', async () => {
  seedUser('alice')
  const code = await createLinkCode('alice')
  assert.equal(fx.read(`telegramLinkCodes/${await sha256Hex(code)}`).uid, 'alice') // only the hash is stored
  assert.match(await say(11, `/start ${code}`), /Connected/)
  const markup = fx.telegram.at(-1).body.reply_markup
  assert.ok(markup.keyboard, 'button menu is sent')
  assert.equal(markup.is_persistent, false, 'menu can be collapsed (opens via the keyboard icon)')
  assert.equal(markup.one_time_keyboard, true, 'menu hides again after a tap')
  const linkDoc = fx.read('telegramLinks/11')
  assert.equal(linkDoc.uid, 'alice')
  assert.equal(linkDoc.sig, await hmacHex(env.LINK_SIGNING_KEY, '11:alice'))
  assert.equal(fx.read('users/alice/settings/telegram').telegramUserId, '11')
  assert.equal(fx.read('users/alice/settings/telegram').timezone, TZ)
  assert.equal(fx.read(`telegramLinkCodes/${await sha256Hex(code)}`), null) // consumed
})

test('2. rejects an expired linking code', async () => {
  const code = await createLinkCode('alice', { ttlMs: -1000 })
  assert.match(await say(12, `/start ${code}`), /expired/)
  assert.equal(fx.read('telegramLinks/12'), null)
})

test('3. rejects a reused linking code', async () => {
  const code = await createLinkCode('alice')
  assert.match(await say(13, `/start ${code}`), /Connected/)
  assert.match(await say(14, `/start ${code}`), /isn't valid/)
  assert.equal(fx.read('telegramLinks/14'), null)
})

test('rejects malformed / guessed codes', async () => {
  assert.match(await say(15, '/start abc'), /isn't valid/)
  assert.match(await say(15, '/start ' + 'a'.repeat(32)), /isn't valid/)
})

test('one Telegram ⇄ one account: cannot link to a second account without /unlink', async () => {
  await link(20, 'alice')
  assert.match(await say(20, `/start ${await createLinkCode('bob')}`), /already connected to another/)
  assert.equal(fx.read('telegramLinks/20').uid, 'alice')
  assert.match(await say(21, `/start ${await createLinkCode('alice')}`), /already connected to a different Telegram/)
})

// ── 4. Unlinked access ────────────────────────────────────────────────────────
test('4. an unlinked Telegram account cannot read financial data', async () => {
  seedUser('alice')
  for (const text of ['/balance', '/report', '/recent', '/budget', '/expense 5 Food x', '5 food', KEYS.balance]) {
    assert.match(await say(99, text), /isn't connected yet/, text)
  }
  assert.ok(!fx.telegram.some((c) => /2,500/.test(c.body.text || '')))
})

test('forged link (no valid HMAC signature) is not trusted', async () => {
  seedUser('alice')
  fx.seed('telegramLinks/66', { uid: 'alice', sig: 'forged' })
  fx.seed('users/alice/settings/telegram', { telegramUserId: '66' })
  assert.match(await say(66, '/balance'), /isn't connected yet/)
})

test('disconnecting in the app revokes access immediately — even with the link cached', async () => {
  seedUser('alice')
  await link(30, 'alice')
  await say(30, '/balance') // link is now cached in this isolate
  fx.store.delete('users/alice/settings/telegram') // what the app's Disconnect button does
  assert.match(await say(30, '/balance'), /isn't connected yet/)
  assert.equal(fx.read('telegramLinks/30'), null) // stale mapping cleaned up
})

test('refuses to show data in group chats', async () => {
  seedUser('alice')
  await link(31, 'alice')
  await post(msg(31, '/balance', 'group'))
  assert.match(fx.lastText(), /private chat/)
})

// ── 5. Balance ────────────────────────────────────────────────────────────────
test('5. balance uses the app formula income − expense + borrow − payback', async () => {
  seedUser('alice')
  await link(40, 'alice')
  const text = await say(40, '/balance')
  assert.match(text, /Your balance<\/b>\n<b>\$600\.00<\/b>/) // 2500 − 2200 + 300
  assert.match(text, /Total income\s+\$2,500\.00/)
  assert.match(text, /Total expenses\s+\$2,200\.00/)
  assert.match(text, /= <b>\+\$1,600\.00<\/b>/) // this month: 2500 − 1200 + 300
})

test('bottom keyboard buttons work without commands', async () => {
  seedUser('alice')
  await link(42, 'alice')
  assert.match(await say(42, KEYS.balance), /Your balance/)
  assert.match(await say(42, KEYS.report), /Net savings/)
  assert.match(await say(42, KEYS.recent), /what would you like to see/)
  assert.match(await say(42, KEYS.budget), /Budget ·/)
  assert.match(await say(42, KEYS.more), /More/)
  assert.match(await say(42, KEYS.expense), /How much\?/)
})

test('shows amounts in KHR when the app preference is KHR', async () => {
  seedUser('alice')
  fx.seed('users/alice/settings/preferences', { currency: 'KHR' })
  await link(41, 'alice')
  assert.match(await say(41, '/balance'), /KHR\s?2,407,800/) // 600 × 4013
})

// ── 6–10. Adding ──────────────────────────────────────────────────────────────
test('6. /addincome asks for confirmation, then saves in the app schema', async () => {
  seedUser('alice')
  await link(50, 'alice', { confirm: true })
  const before = txCount('alice')
  assert.match(await say(50, '/addincome 100 Salary Monthly salary'), /Save this income\?[\s\S]*\$100\.00[\s\S]*Salary[\s\S]*Monthly salary/)
  assert.equal(txCount('alice'), before) // nothing saved yet
  const nonce = confirmNonce()
  assert.match(await tap(50, `ok:${nonce}`), /Saved/)
  const saved = fx.read(`users/alice/transactions/tg_${nonce}`)
  assert.deepEqual(
    { type: saved.type, amount: saved.amount, category: saved.category, description: saved.description, date: saved.date, source: saved.source },
    { type: 'income', amount: 100, category: 'salary_4', description: 'Monthly salary', date: today(), source: 'telegram' }
  )
  assert.ok(!Number.isNaN(Date.parse(saved.createdAt)))
})

test('7. /addexpense with a multi-word category and decimals', async () => {
  seedUser('alice')
  await link(51, 'alice', { confirm: true })
  assert.match(await say(51, '/addexpense 12.50 food & dining out Taxi home'), /Food &amp; Dining Out/)
  const nonce = confirmNonce()
  assert.match(await tap(51, `ok:${nonce}`), /\$12\.50[\s\S]*Taxi home/)
  const saved = fx.read(`users/alice/transactions/tg_${nonce}`)
  assert.equal(saved.amount, 12.5)
  assert.equal(saved.category, 'dining_2')
})

test('confirm mode: typing "5 food lunch" goes straight to confirmation', async () => {
  seedUser('alice')
  await link(52, 'alice', { confirm: true })
  assert.match(await say(52, '5.50 food lunch'), /Save this expense\?[\s\S]*\$5\.50[\s\S]*🍽 Food[\s\S]*lunch/)
  assert.match(await say(52, '+100 salary bonus'), /Save this income\?[\s\S]*\$100\.00[\s\S]*Salary[\s\S]*bonus/)
  assert.match(await say(52, '/expense 3 Food x'), /Save this expense\?/) // command form still works
})

test('confirm mode: "5 coffee" (unknown category) asks for the category and keeps the note', async () => {
  seedUser('alice')
  await link(53, 'alice', { confirm: true })
  assert.match(await say(53, '5 coffee'), /Which category\?/)
  assert.match(await tap(53, button('Food').callback_data), /Save this expense\?[\s\S]*Food[\s\S]*coffee/)
  const nonce = confirmNonce()
  await tap(53, `ok:${nonce}`)
  assert.equal(fx.read(`users/alice/transactions/tg_${nonce}`).description, 'coffee')
})

test('8. cancelling saves nothing', async () => {
  seedUser('alice')
  await link(54, 'alice', { confirm: true })
  const before = txCount('alice')
  await say(54, '5 food lunch')
  const nonce = confirmNonce()
  assert.match(await tap(54, `no:${nonce}`), /Cancelled/)
  assert.match(await tap(54, `ok:${nonce}`), /expired/) // can't confirm after cancelling
  assert.equal(txCount('alice'), before)
})

test('9. guided flow: type → amount (button) → category → note → confirm', async () => {
  seedUser('alice')
  await link(55, 'alice', { confirm: true })
  assert.match(await say(55, '/add'), /What would you like to add/)
  assert.match(await tap(55, 'add:expense'), /How much\?/)
  assert.match(await say(55, 'abc'), /Invalid amount/)
  assert.match(await tap(55, 'amt:5'), /Which category\?/)
  assert.match(await tap(55, button('Transport').callback_data), /short note/)
  assert.match(await say(55, 'Bus'), /Save this expense\?[\s\S]*\$5\.00[\s\S]*Transport[\s\S]*Bus/)
  const nonce = confirmNonce()
  await tap(55, `ok:${nonce}`)
  assert.equal(fx.read(`users/alice/transactions/tg_${nonce}`).category, 'transport_3')
})

test('confirm screen: switch to yesterday and change category before saving', async () => {
  seedUser('alice')
  await link(56, 'alice', { confirm: true })
  await say(56, '7 food')
  assert.match(await tap(56, `dt:${confirmNonce()}`), /📅 Yesterday/)
  assert.match(await tap(56, `chg:${confirmNonce()}`), /Which category\?/)
  assert.match(await tap(56, button('Transport').callback_data), /Save this expense\?[\s\S]*Transport[\s\S]*Yesterday/)
  const nonce = confirmNonce()
  await tap(56, `ok:${nonce}`)
  const saved = fx.read(`users/alice/transactions/tg_${nonce}`)
  assert.equal(saved.date, dayBefore(today()))
  assert.equal(saved.category, 'transport_3')
})

test('undo removes the transaction just saved — and only bot-created ones', async () => {
  seedUser('alice')
  await link(57, 'alice', { confirm: true })
  await say(57, '9 food')
  const nonce = confirmNonce()
  await tap(57, `ok:${nonce}`)
  assert.ok(button('Undo'))
  assert.match(await tap(57, `undo:tg_${nonce}`), /Undone/)
  assert.equal(fx.read(`users/alice/transactions/tg_${nonce}`), null)
  await tap(57, 'undo:a1') // an app-created transaction id
  assert.ok(fx.read('users/alice/transactions/a1'), 'undo must not touch non-bot transactions')
})

test('10. rejects invalid amounts', async () => {
  seedUser('alice')
  await link(58, 'alice')
  for (const bad of ['abc', '-5', '0', '1.234', '5e3']) {
    assert.match(await say(58, `/addexpense ${bad} Food Lunch`), /Invalid amount/, bad)
  }
  assert.match(await say(58, '0 food'), /Invalid amount/)
  assert.equal(fx.read('telegramSessions/58'), null) // nothing pending
})

test('11. unknown category in a command offers the valid ones as buttons', async () => {
  seedUser('alice')
  await link(59, 'alice', { confirm: true })
  assert.match(await say(59, '/addexpense 5 Groceries milk'), /Unknown category “Groceries”[\s\S]*Which category\?/)
  assert.ok(button('Food'), 'expense categories offered')
  assert.ok(!button('Salary'), 'income categories not offered')
})

// ── 12. Idempotency ───────────────────────────────────────────────────────────
test('12. duplicate webhook delivery / double tap saves exactly once', async () => {
  seedUser('alice')
  await link(60, 'alice', { confirm: true })
  const before = txCount('alice')
  await say(60, '5 food lunch')
  const update = cb(60, `ok:${confirmNonce()}`)
  await post(update)
  await post(update) // Telegram re-delivers the same update
  await post(cb(60, update.callback_query.data)) // user double-taps
  assert.equal(txCount('alice'), before + 1)
  assert.match(fx.lastText(), /Already saved/)
})

test('12b. concurrent duplicate deliveries never create two documents', async () => {
  seedUser('alice')
  await link(61, 'alice', { confirm: true })
  const before = txCount('alice')
  await say(61, '5 food lunch')
  const update = cb(61, `ok:${confirmNonce()}`)
  await Promise.all([post(update), post(update), post(update)])
  assert.equal(txCount('alice'), before + 1) // deterministic id tg_<nonce>
})

test('12c. atomic save rejects a second write even if both requests passed the session check', async () => {
  const data = createData(createFirestore(env))
  const record = { type: 'expense', amount: 5, category: 'food_1', description: '', date: today(), createdAt: 'x', source: 'telegram' }
  fx.seed('telegramSessions/77', { step: 'confirm', nonce: 'N1' })
  await data.saveConfirmedTransaction('77', 'alice', 'N1', record)
  await assert.rejects(data.saveConfirmedTransaction('77', 'alice', 'N1', { ...record, amount: 999 }), PreconditionError)
  fx.seed('telegramSessions/77', { step: 'confirm', nonce: 'N1' })
  await assert.rejects(data.saveConfirmedTransaction('77', 'alice', 'N1', { ...record, amount: 999 }), PreconditionError)
  assert.equal(fx.read('users/alice/transactions/tg_N1').amount, 5)
})

test('expired confirmation sessions cannot be confirmed', async () => {
  seedUser('alice')
  await link(62, 'alice', { confirm: true })
  await say(62, '5 food lunch')
  const nonce = confirmNonce()
  const s = fx.read('telegramSessions/62')
  fx.seed('telegramSessions/62', { ...s, id: undefined, expiresAt: new Date(Date.now() - 1000) })
  assert.match(await tap(62, `ok:${nonce}`), /expired/)
  assert.equal(fx.read(`users/alice/transactions/tg_${nonce}`), null)
})

// ── 13–15. Reports and budgets ────────────────────────────────────────────────
test('13. monthly report matches the app calculations', async () => {
  seedUser('alice')
  await link(63, 'alice')
  const text = await say(63, '/report')
  const day = Number(today().slice(8, 10))
  assert.match(text, /Income\s+\$2,500\.00/)
  assert.match(text, /Expenses\s+\$1,200\.00/)
  assert.match(text, /Net savings <b>\+\$1,300\.00<\/b>/)
  assert.match(text, /Savings rate 52%/)
  assert.match(text, /Top spending: 🍽 Food · \$700\.00/)
  const avg = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1200 / day)
  assert.ok(text.includes(`Avg per day: ${avg}`), `expected avg ${avg}`)
  assert.match(text, /Spending up <b>20%<\/b>/) // 1200 vs 1000
  assert.ok(button('◀'), 'previous-month button')
  assert.ok(!button('▶'), 'no future-month button')
})

test('report navigation: previous month and year', async () => {
  seedUser('alice')
  await link(64, 'alice')
  await say(64, '/report')
  assert.match(await tap(64, button('◀').callback_data), /Expenses\s+\$1,000\.00/)
  assert.ok(button('▶'), 'can go forward again from a past month')
  const yearText = await tap(64, `rp:y:${monthKey().slice(0, 4)}`)
  const sameYear = prevMonthKey().slice(0, 4) === monthKey().slice(0, 4)
  assert.match(yearText, new RegExp(`Expenses\\s+\\$${sameYear ? '2,200' : '1,200'}\\.00`))
  assert.match(yearText, /Year \d{4}/)
  assert.match(await say(64, `/report_month ${prevMonthKey()}`), /Expenses\s+\$1,000\.00/)
})

test('15. budgets show limit, spent, remaining and % used', async () => {
  seedUser('alice')
  await link(65, 'alice')
  assert.match(await say(65, '/budget'), /Monthly total[\s\S]*60%[\s\S]*\$1,200\.00 of \$2,000\.00 · \$800\.00 left/)
  assert.match(await say(65, '/budget_food'), /Food[\s\S]*70%[\s\S]*\$700\.00 of \$1,000\.00 · \$300\.00 left/)
  assert.match(await say(65, '/budget_remaining'), /Food: <b>\$300\.00 left<\/b>/)
})

// ── 16. Isolation between users ───────────────────────────────────────────────
test('16. one Telegram user can never touch another user\'s data', async () => {
  seedUser('alice')
  seedUser('bob')
  fx.seed('users/bob/transactions/bobsecret', { type: 'expense', amount: 999, category: 'food_1', date: `${monthKey()}-02`, createdAt: 'x' })
  await link(70, 'alice')
  assert.match(await tap(70, 'del:bobsecret'), /no longer exists/)
  await tap(70, 'delok:bobsecret')
  assert.ok(fx.read('users/bob/transactions/bobsecret'), 'bob\'s transaction must survive')
  assert.doesNotMatch(await say(70, '/report'), /999/)
})

test('/delete shows details first, then deletes the user\'s own transaction', async () => {
  seedUser('alice')
  await link(71, 'alice')
  await say(71, '/delete')
  const pick = button((b) => b.callback_data?.startsWith('del:'))
  assert.match(await tap(71, pick.callback_data), /Delete this/)
  const id = pick.callback_data.slice(4)
  assert.match(await tap(71, `delok:${id}`), /Deleted/)
  assert.equal(fx.read(`users/alice/transactions/${id}`), null)
  assert.match(await tap(71, `delok:${id}`), /already deleted/)
})

// ── 17–18. Shared data with the Vue app ───────────────────────────────────────
test('17/18. bot transactions land in the app collection; app transactions appear in bot reports', async () => {
  seedUser('alice')
  await link(80, 'alice', { confirm: true })
  await say(80, '40 food dinner')
  await tap(80, `ok:${confirmNonce()}`)
  assert.equal(fx.docsUnder('users/alice/transactions').filter((p) => p.includes('/tg_')).length, 1)
  fx.seed('users/alice/transactions/fromApp', { type: 'expense', amount: 60, category: 'food_1', description: 'From app', date: today(), createdAt: new Date().toISOString() })
  assert.match(await say(80, '/expense_today'), /Total <b>\$100\.00<\/b> · 2 items/)
})

test('/unlink disconnects after confirmation', async () => {
  seedUser('alice')
  await link(90, 'alice')
  await say(90, '/unlink')
  assert.match(await tap(90, 'unlink:yes'), /Disconnected/)
  assert.equal(fx.read('telegramLinks/90'), null)
  assert.equal(fx.read('users/alice/settings/telegram'), null)
  assert.match(await say(90, '/balance'), /isn't connected yet/)
})

// ── Speed ─────────────────────────────────────────────────────────────────────
test('speed: a warm request needs only 2 Firestore round trips and replies via the webhook response', async () => {
  seedUser('alice')
  await link(91, 'alice')
  await say(91, '/balance') // warm: token + verified link cached
  const callsBefore = fx.stats.firestoreCalls
  const telegramBefore = fx.telegram.filter((c) => !c.viaWebhookResponse).length
  await say(91, '/balance')
  assert.equal(fx.stats.firestoreCalls - callsBefore, 2, 'batchGet (user/settings/session) + one transactions query')
  assert.equal(fx.telegram.filter((c) => !c.viaWebhookResponse).length, telegramBefore, 'no separate sendMessage call')
  assert.equal(fx.stats.tokenRequests, 1, 'OAuth token reused')
})

test('buttons edit the same message instead of posting new ones', async () => {
  seedUser('alice')
  await link(92, 'alice')
  await post(cb(92, 'm:balance'))
  assert.equal(fx.telegram.at(-1).method, 'editMessageText')
})

// ── Instant save (default) ────────────────────────────────────────────────────
const savedId = (fromId, messageUpdate) => `tg_${fromId}_${messageUpdate.message.message_id}`

test('instant: typing just "5" saves immediately in the most-used expense category', async () => {
  seedUser('alice') // history: Food ×2, Transport ×1
  await link(100, 'alice')
  const before = txCount('alice')
  const update = msg(100, '5')
  await post(update)
  assert.match(fx.lastText(), /Saved[\s\S]*\$5\.00[\s\S]*🍽 Food[\s\S]*today/)
  assert.equal(txCount('alice'), before + 1)
  const saved = fx.read(`users/alice/transactions/${savedId(100, update)}`)
  assert.deepEqual(
    { type: saved.type, amount: saved.amount, category: saved.category, description: saved.description, date: saved.date, source: saved.source },
    { type: 'expense', amount: 5, category: 'food_1', description: '', date: today(), source: 'telegram' }
  )
  assert.ok(button('Undo') && button('Transport'), 'one-tap fixes offered')
})

test('instant: category is learned from earlier notes; named categories win', async () => {
  seedUser('alice')
  fx.seed('users/alice/transactions/h1', { type: 'expense', amount: 2, category: 'transport_3', description: 'Coffee', date: `${monthKey()}-01`, createdAt: 'x' })
  await link(101, 'alice')
  assert.match(await say(101, '3.5 coffee'), /🚗 Transport · coffee/) // learned from "Coffee" → Transport
  assert.match(await say(101, '12 food lunch'), /🍽 Food · lunch/)     // named
  assert.match(await say(101, '+100'), /➕ <b>\$100\.00[\s\S]*Salary/)  // income
})

test('instant: a re-delivered message is saved only once', async () => {
  seedUser('alice')
  await link(102, 'alice')
  const before = txCount('alice')
  const update = msg(102, '7 food')
  await post(update)
  await post(update)
  await Promise.all([post(update), post(update)])
  assert.equal(txCount('alice'), before + 1)
})

test('instant: one tap fixes the category, Other… lists all, date and undo work', async () => {
  seedUser('alice')
  await link(103, 'alice')
  const update = msg(103, '9 snack')
  await post(update)
  const id = savedId(103, update)
  assert.match(await tap(103, button('Transport').callback_data), /🚗 Transport/)
  assert.equal(fx.read(`users/alice/transactions/${id}`).category, 'transport_3')
  assert.match(await tap(103, `rcm:${id}`), /Pick the right category/)
  assert.ok(button('Food & Dining Out'))
  assert.match(await tap(103, button('Food & Dining Out').callback_data), /Food &amp; Dining Out/)
  assert.equal(fx.read(`users/alice/transactions/${id}`).category, 'dining_2')
  assert.match(await tap(103, `ry:${id}`), /yesterday/)
  assert.equal(fx.read(`users/alice/transactions/${id}`).date, dayBefore(today()))
  assert.match(await tap(103, `undo:${id}`), /Undone/)
  assert.equal(fx.read(`users/alice/transactions/${id}`), null)
})

test('instant: two taps — ➖ Expense then $5 — and it\'s saved', async () => {
  seedUser('alice')
  await link(104, 'alice')
  const before = txCount('alice')
  await say(104, KEYS.expense)
  assert.match(await tap(104, 'amt:5'), /Saved[\s\S]*\$5\.00/)
  assert.equal(txCount('alice'), before + 1)
  assert.equal(fx.read('telegramSessions/104'), null) // flow finished
  assert.match(await say(104, KEYS.income), /How much\?/)
  assert.match(await say(104, '250 freelance work'), /Saved[\s\S]*\$250\.00[\s\S]*Salary · freelance work/)
})

test('instant: settings toggle switches the confirm step on and off', async () => {
  seedUser('alice')
  await link(105, 'alice')
  assert.match(await tap(105, 'm:settings'), /saves instantly/)
  assert.match(await tap(105, 'cfm:on'), /asks you to confirm first/)
  assert.equal(fx.read('users/alice/settings/telegram').confirmBeforeSave, true)
  assert.match(await say(105, '5 food'), /Save this expense\?/)
  await tap(105, 'cfm:off')
  assert.match(await say(105, '5 food'), /Saved/)
})

test('instant: fix buttons can\'t touch another user\'s transaction or category', async () => {
  seedUser('alice')
  seedUser('bob')
  fx.seed('users/bob/transactions/tg_999_1', { type: 'expense', amount: 50, category: 'food_1', date: today(), createdAt: 'x' })
  await link(106, 'alice')
  assert.match(await tap(106, 'rc:tg_999_1:c3'), /no longer exists/)
  assert.match(await tap(106, 'ry:tg_999_1'), /no longer exists/)
  await tap(106, 'undo:tg_999_1')
  assert.equal(fx.read('users/bob/transactions/tg_999_1').category, 'food_1')
  assert.ok(fx.read('users/bob/transactions/tg_999_1'), 'bob\'s transaction untouched')
  // and a category id that isn't one of Alice's own (income ≠ expense here) is refused
  const update = msg(106, '4 food')
  await post(update)
  assert.match(await tap(106, `rc:${savedId(106, update)}:c4`), /expired/) // c4 = Alice's INCOME category
  assert.equal(fx.read(`users/alice/transactions/${savedId(106, update)}`).category, 'food_1')
})

test('instant: a signed amount after a typed command is rejected, not flipped', async () => {
  seedUser('alice')
  await link(107, 'alice')
  const before = txCount('alice')
  assert.match(await say(107, '/addexpense -5 Food'), /Invalid amount/)
  await say(107, KEYS.expense)
  assert.match(await say(107, '-5'), /Invalid amount/)
  assert.equal(txCount('alice'), before)
})

test('instant: a late re-delivery never overwrites a category the user already fixed', async () => {
  seedUser('alice')
  await link(108, 'alice')
  const update = msg(108, '6 food')
  await post(update)
  const id = savedId(108, update)
  await tap(108, button('Transport').callback_data) // user fixes the category
  await post(update)                                // Telegram re-delivers the original message
  assert.equal(fx.read(`users/alice/transactions/${id}`).category, 'transport_3')
})

test('no blue Menu pill: command list removed, menu button set to default', async () => {
  await say(110, '/start')
  await new Promise((r) => setTimeout(r, 20)) // runs in the background
  assert.ok(fx.telegram.find((c) => c.method === 'deleteMyCommands'), 'command list removed')
  assert.deepEqual(fx.telegram.find((c) => c.method === 'setChatMenuButton').body.menu_button, { type: 'default' })
  assert.ok(!fx.telegram.find((c) => c.method === 'setMyCommands'), 'no command list registered')
  // the command definitions are still valid for typing / a future menu
  const { BOT_COMMANDS } = await import('../src/telegram/commands.js')
  const names = BOT_COMMANDS.map((c) => c.command)
  assert.equal(new Set(names).size, names.length, 'no duplicate commands')
  for (const c of BOT_COMMANDS) {
    assert.match(c.command, /^[a-z0-9_]{1,32}$/)
    assert.ok(c.description.length >= 1 && c.description.length <= 256)
  }
})

test('every command in the Menu actually works', async () => {
  seedUser('alice')
  await link(111, 'alice')
  const { BOT_COMMANDS } = await import('../src/telegram/commands.js')
  for (const { command } of BOT_COMMANDS) {
    const text = await say(111, `/${command}`)
    assert.doesNotMatch(text, /Unknown command|Something went wrong/, `/${command}`)
  }
})

// ── Expense Planner ───────────────────────────────────────────────────────────
function seedPlans(uid) {
  const m = monthKey()
  const day = Number(today().slice(8, 10))
  const future = `${m}-${String(Math.min(28, day + 3)).padStart(2, '0')}`
  fx.seed(`users/${uid}/plannerMonths/${m}`, { incomes: [{ id: 'i1', label: 'Salary', amount: 600 }], savings: [{ id: 's1', label: 'Fund', amount: 100 }] })
  fx.seed(`users/${uid}/plannedExpenses/rent`, { name: 'Rent', amount: 120, category: 'food_1', month: m, dueDate: future, status: 'pending' })
  fx.seed(`users/${uid}/plannedExpenses/late`, { name: 'Phone', amount: 15, category: 'transport_3', month: m, dueDate: `${m}-01`, status: 'pending' })
  fx.seed(`users/${uid}/plannedExpenses/done`, { name: 'Internet', amount: 30, category: 'transport_3', month: m, dueDate: `${m}-01`, status: 'paid', transactionId: 'plan_done' })
  fx.seed(`users/${uid}/plannedExpenses/gone`, { name: 'Gym', amount: 50, category: 'food_1', month: m, dueDate: `${m}-01`, status: 'cancelled' })
}
const nextMonthKey = () => {
  const [y, m] = monthKey().split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
/** Pay through the payment screen: 💳 Pay → ✅ Confirm. */
async function payViaScreen(fromId, id) {
  assert.match(await tap(fromId, `pp:${id}`), /Pay /)
  return tap(fromId, `ppc:${id}`)
}

test('planner: /plan shows the month like the app (cancelled excluded, overdue first)', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(120, 'alice')
  const text = await say(120, '/plan')
  assert.match(text, /Expected income\s+\$600\.00/)
  assert.match(text, /Planned expenses\s+\$165\.00/)       // 120 + 15 + 30 (Gym cancelled)
  assert.match(text, /Planned savings\s+\$100\.00/)
  assert.match(text, /Estimated remaining \$335\.00/)     // 600 − 165 − 100
  assert.match(text, /Still to pay · \$135\.00/)
  const items = buttons().filter((b) => b.callback_data?.startsWith('pi:'))
  assert.deepEqual(items.map((b) => b.callback_data), ['pi:late', 'pi:rent'], 'overdue first, one button per plan to pay')
  assert.match(items[0].text, /Phone · \$15\.00/)
  if (Number(today().slice(8, 10)) > 1) assert.match(items[0].text, /^⚠️/)
  assert.match(await say(120, KEYS.plan), /Plan ·/)
})

test('planner: the payment screen saves nothing until ✅ Confirm', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(121, 'alice')
  assert.ok(await tap(121, 'pi:rent'))
  assert.ok(button((b) => b.callback_data === 'pp:rent'), '💳 Pay offered on the plan')
  const before = txCount('alice')
  const screen = await tap(121, 'pp:rent')
  assert.match(screen, /Pay Rent[\s\S]*Planned\s+\$120\.00[\s\S]*Paying\s+<b>\$120\.00[\s\S]*Today/)
  assert.ok(button('Confirm payment') && button('Different amount') && button('Paid yesterday'))
  assert.equal(txCount('alice'), before, 'opening the payment screen writes nothing')
  assert.equal(fx.read('users/alice/plannedExpenses/rent').status, 'pending')
})

test('planner: confirming creates the same real expense as the app — once', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(122, 'alice')
  const before = txCount('alice')
  assert.match(await payViaScreen(122, 'rent'), /Paid<\/b> — Rent · \$120\.00/)
  const tx = fx.read('users/alice/transactions/plan_rent')
  assert.deepEqual(
    { type: tx.type, amount: tx.amount, category: tx.category, description: tx.description, date: tx.date, source: tx.source, plannedExpenseId: tx.plannedExpenseId },
    { type: 'expense', amount: 120, category: 'food_1', description: 'Rent', date: today(), source: 'planner', plannedExpenseId: 'rent' }
  )
  const p = fx.read('users/alice/plannedExpenses/rent')
  assert.equal(p.status, 'paid'); assert.equal(p.transactionId, 'plan_rent'); assert.equal(p.actualAmount, 120)
  assert.match(await tap(122, 'ppc:rent'), /already paid/)   // double tap
  assert.match(await tap(122, 'pp:rent'), /already paid/)
  assert.equal(txCount('alice'), before + 1)
})

test('planner: pay a different amount, paid yesterday — the plan keeps its planned amount', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(123, 'alice')
  await tap(123, 'pp:rent')
  assert.match(await tap(123, 'ppa:rent'), /How much did you actually pay/)
  assert.match(await say(123, 'abc'), /Invalid amount/)
  assert.match(await say(123, '110'), /Paying\s+<b>\$110\.00<\/b> <i>\(\$10\.00 less than planned\)/)
  assert.match(await tap(123, 'ppd:rent'), /Date\s+Yesterday/)
  assert.match(await tap(123, 'ppc:rent'), /Paid<\/b> — Rent · \$110\.00 <i>\(planned \$120\.00\)/)
  const tx = fx.read('users/alice/transactions/plan_rent')
  assert.equal(tx.amount, 110)
  assert.equal(tx.date, dayBefore(today()))
  const p = fx.read('users/alice/plannedExpenses/rent')
  assert.equal(p.amount, 120, 'planned amount kept for plan-vs-actual')
  assert.equal(p.actualAmount, 110)
  assert.equal(p.paidAt, dayBefore(today()))
})

test('planner: an expired payment screen asks to start again instead of paying', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(124, 'alice')
  await tap(124, 'pp:rent')
  const s = fx.read('telegramSessions/124')
  fx.seed('telegramSessions/124', { ...s, expiresAt: new Date(Date.now() - 1000) })
  assert.match(await tap(124, 'ppc:rent'), /expired/)
  assert.equal(fx.read('users/alice/transactions/plan_rent'), null)
  assert.ok(button('Start again'))
})

test('planner: if the app already paid it, the bot cannot pay it again', async () => {
  seedUser('alice'); seedPlans('alice')
  fx.seed('users/alice/transactions/plan_rent', { type: 'expense', amount: 120, category: 'food_1', date: today(), createdAt: 'x' })
  await link(125, 'alice')
  const before = txCount('alice')
  assert.match(await payViaScreen(125, 'rent'), /already paid/)
  assert.equal(txCount('alice'), before)
  assert.equal(fx.read('users/alice/plannedExpenses/rent').status, 'pending', 'atomic: nothing half-written')
})

test('planner: undo payment removes the expense and makes the plan pending again', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(126, 'alice')
  await payViaScreen(126, 'rent')
  assert.match(await tap(126, 'pu:rent'), /Payment undone/)
  assert.equal(fx.read('users/alice/transactions/plan_rent'), null)
  const p = fx.read('users/alice/plannedExpenses/rent')
  assert.equal(p.status, 'pending')
  assert.equal(p.transactionId, undefined); assert.equal(p.actualAmount, undefined); assert.equal(p.paidAt, undefined)
})

test('planner: cancel asks first, then restore brings it back', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(127, 'alice')
  assert.match(await tap(127, 'pc:rent'), /Cancel “<b>Rent<\/b>”\?/)
  assert.equal(fx.read('users/alice/plannedExpenses/rent').status, 'pending', 'nothing changes before confirming')
  assert.match(await tap(127, 'pcy:rent'), /Cancelled/)
  assert.equal(fx.read('users/alice/plannedExpenses/rent').status, 'cancelled')
  assert.match(await tap(127, 'prs:rent'), /Restored/)
  assert.equal(fx.read('users/alice/plannedExpenses/rent').status, 'pending')
  assert.match(await tap(127, 'pcy:done'), /undo the payment first/)
})

test('planner: adding asks for the category (suggestion first, ✓) and saves on tap', async () => {
  seedUser('alice')
  await link(128, 'alice')
  const txBefore = txCount('alice')
  const update = msg(128, '/planadd 120 Food & Dining Out party 10')
  await post(update)
  assert.match(fx.lastText(), /Food &amp; Dining Out party<\/b> · \$120\.00 · due[\s\S]*Which category\?/)
  const cats = buttons().filter((b) => b.callback_data?.startsWith('pcat:'))
  assert.match(cats[0].text, /^✓ .*Food & Dining Out/, 'best guess first, marked ✓')
  assert.equal(fx.docsUnder('users/alice/plannedExpenses').length, 0, 'nothing saved before choosing')
  const transport = cats.find((b) => b.text.includes('Transport'))
  assert.match(await tap(128, transport.callback_data), /Planned<\/b> — Food &amp; Dining Out party · \$120\.00[\s\S]*Transport/)
  const id = `tgp_128_${update.message.message_id}`
  const p = fx.read(`users/alice/plannedExpenses/${id}`)
  assert.deepEqual(
    { name: p.name, amount: p.amount, category: p.category, month: p.month, dueDate: p.dueDate, status: p.status },
    { name: 'Food & Dining Out party', amount: 120, category: 'transport_3', month: monthKey(), dueDate: `${monthKey()}-10`, status: 'pending' }
  )
  assert.equal(txCount('alice'), txBefore, 'planning never creates a transaction')
  // Telegram re-delivers the message and the user taps again → still one plan
  await post(update)
  await tap(128, buttons().find((b) => b.callback_data?.startsWith('pcat:')).callback_data)
  assert.equal(fx.docsUnder('users/alice/plannedExpenses').length, 1)
  assert.match(await tap(128, `pd:${id}`), /Removed/)
  assert.equal(fx.read(`users/alice/plannedExpenses/${id}`), null)
})

test('planner: change the category of an existing plan', async () => {
  seedUser('alice'); seedPlans('alice')
  await link(129, 'alice')
  await tap(129, 'pi:rent')
  assert.match(await tap(129, 'prcm:rent'), /New category for <b>Rent<\/b>/)
  assert.match(button('Food').text, /^✓/, 'current category is ticked')
  await tap(129, button('Transport').callback_data)
  assert.equal(fx.read('users/alice/plannedExpenses/rent').category, 'transport_3')
})

test('planner: guided add, next month, and validation', async () => {
  seedUser('alice')
  await link(130, 'alice')
  assert.match(await tap(130, `pa:${monthKey()}`), /Plan an expense[\s\S]*choose the category/)
  assert.match(await say(130, '15 Internet 6'), /Which category\?/)
  assert.match(await say(130, 'hello'), /Tap a category above/)
  assert.match(await tap(130, 'pcat:0'), /Planned<\/b> — Internet · \$15\.00/)
  await say(130, '/plannext 50 Gym')
  await tap(130, 'pcat:0')
  const gym = fx.docsUnder('users/alice/plannedExpenses').map((path) => fx.read(path)).find((x) => x.name === 'Gym')
  assert.equal(gym.month, nextMonthKey()); assert.equal(gym.dueDate, `${nextMonthKey()}-01`)
  assert.match(await say(130, '/planadd 120 Rent 40'), /pick a due day from 1 to/)
  assert.match(await say(130, '/planadd abc Rent'), /couldn't read that/)
  assert.match(await say(130, '/planadd 0 Rent'), /Invalid amount/)
})

test('planner: recurring plans appear in the bot without duplicates', async () => {
  seedUser('alice')
  const [y, m] = monthKey().split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 2, 15)).toISOString().slice(0, 10)
  fx.seed('users/alice/plannedSeries/sr1', { name: 'Internet', amount: 15, category: 'transport_3', frequency: 'monthly', anchorDate: prev, active: true })
  fx.seed('users/alice/plannedSeries/sr2', { name: 'Old', amount: 9, category: 'food_1', frequency: 'monthly', anchorDate: prev, active: false })
  await link(131, 'alice')
  await say(131, '/plan')
  assert.ok(button('Internet · $15.00'), 'occurrence listed')
  await say(131, '/plan')
  const ids = fx.docsUnder('users/alice/plannedExpenses').map((p) => p.split('/').pop())
  assert.deepEqual(ids, [`sr1_${monthKey()}-15`], 'one occurrence, paused series skipped')
})

test('planner: buttons can never reach another user\'s plans', async () => {
  seedUser('alice'); seedUser('bob'); seedPlans('bob')
  await link(132, 'alice')
  assert.match(await tap(132, 'pi:rent'), /no longer exists/)
  assert.match(await tap(132, 'pp:rent'), /no longer exists/)
  assert.match(await tap(132, 'ppc:rent'), /no longer exists/)
  assert.match(await tap(132, 'pcy:rent'), /no longer exists/)
  assert.equal(fx.read('users/bob/plannedExpenses/rent').status, 'pending')
  assert.equal(fx.read('users/bob/transactions/plan_rent'), null)
})

// ── Day view: today / yesterday / any day ─────────────────────────────────────
function seedDays(uid) {
  // categories only — keeps day totals independent of seedUser's month data
  fx.seed(`users/${uid}/categories/c1`, { type: 'expense', label: 'Food', icon: 'utensils', value: 'food_1' })
  fx.seed(`users/${uid}/categories/c3`, { type: 'expense', label: 'Transport', icon: 'car', value: 'transport_3' })
  fx.seed(`users/${uid}/categories/c4`, { type: 'income', label: 'Salary', icon: 'briefcase', value: 'salary_4' })
  const t = today(), y = dayBefore(t)
  fx.seed(`users/${uid}/transactions/d1`, { type: 'expense', amount: 30, category: 'food_1', description: 'lunch', date: t, createdAt: `${t}T05:00:00Z` })
  fx.seed(`users/${uid}/transactions/d2`, { type: 'expense', amount: 15, category: 'transport_3', description: 'taxi', date: t, createdAt: `${t}T06:00:00Z` })
  fx.seed(`users/${uid}/transactions/d3`, { type: 'income', amount: 100, category: 'salary_4', description: '', date: t, createdAt: `${t}T07:00:00Z` })
  fx.seed(`users/${uid}/transactions/d4`, { type: 'expense', amount: 20, category: 'food_1', description: 'dinner', date: y, createdAt: `${y}T12:00:00Z` })
}

test('day view: today shows what I spent, income, net and the top category', async () => {
  seedDays('dana')
  await link(150, 'dana')
  const text = await say(150, '/today')
  assert.match(text, /📅 <b>Today · /)
  assert.match(text, /Spent \$45\.00/)
  assert.match(text, /Income \$100\.00/)
  assert.match(text, /= \+\$55\.00 for the day/)
  assert.match(text, /Most on: 🍽 Food · \$30\.00/)
  assert.match(text, /lunch[\s\S]*taxi|taxi[\s\S]*lunch/)
  assert.doesNotMatch(text, /dinner/, 'yesterday is not mixed in')
  assert.ok(button('◀'), 'can go to the previous day')
  assert.ok(!button('▶'), 'never offers a future day')
})

test('day view: yesterday, arrows, and the future is clamped to today', async () => {
  seedDays('dana')
  await link(131, 'dana')
  const yText = await say(131, '/yesterday')
  assert.match(yText, /Yesterday · [\s\S]*Spent \$20\.00/)
  assert.ok(button('▶'), 'can step forward to today')
  assert.match(await tap(131, button('▶').callback_data), /Today ·/)
  const tomorrow = (() => { const [y, m, d] = today().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) })()
  assert.match(await tap(131, `rd:${tomorrow}`), /Today ·/)
  assert.match(await say(131, `/day ${dayBefore(dayBefore(today()))}`), /Nothing recorded on this day/)
})

test('day view: Report and Recent have Today / Yesterday / Pick a day buttons', async () => {
  seedDays('dana')
  await link(132, 'dana')
  await say(132, '/report')
  assert.ok(button((b) => b.callback_data === `rd:${today()}`), 'report → today')
  assert.ok(button((b) => b.callback_data === `rd:${dayBefore(today())}`), 'report → yesterday')
  await say(132, '/recent')
  assert.ok(button((b) => b.callback_data === `rd:${today()}`), 'recent → today')
  assert.match(await tap(132, 'rdp'), /Pick a day/)
  const days = buttons().filter((b) => b.callback_data?.startsWith('rd:'))
  assert.equal(days.length, 14)
  assert.equal(days[0].text, 'Today'); assert.equal(days[1].text, 'Yesterday')
  assert.match(await tap(132, days[1].callback_data), /Spent \$20\.00/)
  assert.match(await say(132, '/day'), /Which day\?/)
})

// ── 🧾 Recent: choose first, then load ────────────────────────────────────────
test('recent: the chooser appears without loading any transactions', async () => {
  seedDays('dana')
  await link(140, 'dana')
  await say(140, '/balance') // warm up: token + link cached, like a real session
  const calls = fx.stats.firestoreCalls
  const text = await say(140, KEYS.recent)
  assert.match(text, /what would you like to see/)
  assert.equal(fx.stats.firestoreCalls - calls, 1, 'only the user/session lookup — no transaction query')
  for (const label of ['Today', 'Yesterday', 'This month', 'Pick a day', 'Latest 10']) assert.ok(button(label), label)
})

test('recent: This month shows spent, income, net and its transactions; arrows stop at this month', async () => {
  seedDays('dana')
  const prevM = (() => { const [y, m] = monthKey().split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` })()
  fx.seed('users/dana/transactions/old', { type: 'expense', amount: 999, category: 'food_1', description: 'old', date: `${prevM}-15`, createdAt: 'x' })
  await link(141, 'dana')
  await say(141, '/recent')
  const text = await tap(141, button('This month').callback_data)
  const sameMonth = dayBefore(today()).slice(0, 7) === monthKey()
  assert.match(text, new RegExp(`Spent \\$${sameMonth ? '65' : '45'}\\.00`)) // 30 + 15 (+ 20 yesterday if same month)
  assert.match(text, /Income \$100\.00/)
  assert.doesNotMatch(text, /999/, 'other months are not mixed in')
  assert.ok(!button('▶'), 'no future month')
  assert.match(await tap(141, button('◀').callback_data), /Spent \$999\.00/)
})

test('recent: Latest 10 is still one tap away', async () => {
  seedDays('dana')
  await link(142, 'dana')
  await say(142, '/recent')
  assert.match(await tap(142, 'm:latest'), /Latest 4/)
})
