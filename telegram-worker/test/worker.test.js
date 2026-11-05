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
  assert.ok(fx.telegram.at(-1).body.reply_markup.keyboard, 'persistent bottom keyboard is sent')
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
  assert.match(await say(42, KEYS.recent), /Latest/)
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

test('registers the Telegram "Menu" button and command list', async () => {
  await say(110, '/start')
  await new Promise((r) => setTimeout(r, 20)) // registration runs in the background
  const cmds = fx.telegram.find((c) => c.method === 'setMyCommands')
  const menu = fx.telegram.find((c) => c.method === 'setChatMenuButton')
  assert.ok(cmds, 'setMyCommands called')
  assert.deepEqual(menu.body.menu_button, { type: 'commands' })
  const names = cmds.body.commands.map((c) => c.command)
  assert.equal(names[0], 'add', 'most useful command first')
  for (const c of cmds.body.commands) {
    assert.match(c.command, /^[a-z0-9_]{1,32}$/)            // Telegram's rules
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
