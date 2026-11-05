// Keyboards. callback_data must stay ≤ 64 bytes and never carries a uid —
// the user is always re-resolved server-side from the Telegram sender.
import { catEmoji, shortMonth } from './messages.js'

const btn = (text, data) => ({ text, callback_data: data })
const rows = (buttons, perRow) => {
  const out = []
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow))
  return out
}

// ── Persistent bottom keyboard (always visible, no commands to remember) ─────
export const KEYS = {
  expense: '➖ Expense',
  income: '➕ Income',
  balance: '💰 Balance',
  report: '📊 Report',
  recent: '🧾 Recent',
  budget: '🎯 Budget',
  plan: '🗓 Plan',
  more: '☰ More',
}
export const mainKeyboard = () => ({
  keyboard: [
    [{ text: KEYS.expense }, { text: KEYS.income }],
    [{ text: KEYS.balance }, { text: KEYS.report }, { text: KEYS.recent }],
    [{ text: KEYS.budget }, { text: KEYS.plan }, { text: KEYS.more }],
  ],
  resize_keyboard: true,
  // Collapsible: closed by default after use; Telegram shows a ⌘ keyboard icon
  // in the message box to open it again (or Menu → /menu).
  is_persistent: false,
  one_time_keyboard: true,
  input_field_placeholder: 'Type 5 coffee or +100 salary',
})

// ── Inline menus ──────────────────────────────────────────────────────────────
export const moreMenu = () => ({
  inline_keyboard: [
    [btn('📥 Income', 'sum:income:month'), btn('📤 Expenses', 'sum:expense:month')],
    [btn('🎯 Budgets', 'm:budget'), btn('🗑 Delete', 'm:delete')],
    [btn('🗓 Spending plan', 'pl:now'), btn('📅 This year', 'rp:y:now')],
    [btn('⚙️ Settings', 'm:settings')],
    [btn('❓ Help', 'm:help')],
  ],
})

export const back = () => ({ inline_keyboard: [[btn('◀️ More', 'm:more')]] })

export const balanceActions = () => ({
  inline_keyboard: [[btn('📊 Report', 'rp:m:now'), btn('🧾 Recent', 'm:recent')]],
})

export const summaryToggle = (type, scope) => ({
  inline_keyboard: [
    [
      btn(scope === 'today' ? '• Today •' : 'Today', `sum:${type}:today`),
      btn(scope === 'month' ? '• This month •' : 'This month', `sum:${type}:month`),
    ],
    [btn(type === 'income' ? '➕ Add income' : '➖ Add expense', `add:${type}`), btn('◀️ More', 'm:more')],
  ],
})

// ── Day view (Today / Yesterday / any day) ──────────────────────────────────
const shiftDay = (date, n) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
export const dayLabel = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Quick row for Report / Recent: Today · Yesterday · Pick a day */
export const dayShortcuts = (today) => [
  btn('📅 Today', `rd:${today}`), btn('📅 Yesterday', `rd:${shiftDay(today, -1)}`), btn('🗓 Pick a day', 'rdp'),
]

export const dayNav = (date, today) => {
  const prev = shiftDay(date, -1)
  const next = shiftDay(date, 1)
  const nav = [btn(`◀ ${dayLabel(prev)}`, `rd:${prev}`)]
  if (next <= today) nav.push(btn(`${dayLabel(next)} ▶`, `rd:${next}`)) // never into the future
  return {
    inline_keyboard: [
      nav,
      [btn('🗓 Pick a day', 'rdp'), btn('📊 Month report', `rp:m:${date.slice(0, 7)}`)],
    ],
  }
}

/** Last 14 days, newest first. */
export const dayPicker = (today) => ({
  inline_keyboard: [
    ...rows(Array.from({ length: 14 }, (_, i) => shiftDay(today, -i)).map((d, i) =>
      btn(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : dayLabel(d), `rd:${d}`)), 3),
    [btn('◀️ Back', 'm:recent')],
  ],
})

/** 🧾 Recent: choose WHAT to see first (no data is loaded for this screen). */
export const recentChooser = (today) => ({
  inline_keyboard: [
    [btn('📅 Today', `rd:${today}`), btn('📅 Yesterday', `rd:${shiftDay(today, -1)}`)],
    [btn('🗓 This month', `rmo:${today.slice(0, 7)}`), btn('🗓 Pick a day', 'rdp')],
    [btn('🧾 Latest 10', 'm:latest')],
  ],
})

/** Month list navigation (never into the future). */
export const monthListNav = (month, today) => {
  const [y, m] = month.split('-').map(Number)
  const shift = (d) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1))
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const nav = [btn(`◀ ${shortMonth(shift(-1))}`, `rmo:${shift(-1)}`)]
  if (month < today.slice(0, 7)) nav.push(btn(`${shortMonth(shift(1))} ▶`, `rmo:${shift(1)}`))
  return { inline_keyboard: [nav, [btn('📅 Today', `rd:${today}`), btn('🗓 Pick a day', 'rdp')], [btn('◀️ Back', 'm:recent')]] }
}

export const recentActions = (today) => ({
  inline_keyboard: [
    ...(today ? [dayShortcuts(today)] : []),
    [btn('🗑 Delete one', 'm:delete'), btn('➖ Add expense', 'add:expense')],
  ],
})

// ── Add flow ──────────────────────────────────────────────────────────────────
export const chooseType = () => ({
  inline_keyboard: [
    [btn('➖ Expense', 'add:expense'), btn('➕ Income', 'add:income')],
    [btn('✖️ Cancel', 'cancel')],
  ],
})

const QUICK_AMOUNTS = { expense: [1, 2, 5, 10, 20, 50], income: [10, 50, 100, 200, 500, 1000] }
export const amounts = (type) => ({
  inline_keyboard: [
    ...rows((QUICK_AMOUNTS[type] || QUICK_AMOUNTS.expense).map((a) => btn(`$${a}`, `amt:${a}`)), 3),
    [btn('✖️ Cancel', 'cancel')],
  ],
})

/** Category picker — callback carries the index into the session's list. */
export const categories = (options) => ({
  inline_keyboard: [
    ...rows(options.map((c, i) => btn(`${catEmoji(c.icon)} ${c.label}`.slice(0, 32), `cat:${i}`)), 2),
    [btn('✖️ Cancel', 'cancel')],
  ],
})

export const skipNote = () => ({
  inline_keyboard: [[btn('Skip ⏭', 'skip'), btn('✖️ Cancel', 'cancel')]],
})

export const confirmSave = (nonce, isToday) => ({
  inline_keyboard: [
    [btn('✅ Save', `ok:${nonce}`), btn('✖️ Cancel', `no:${nonce}`)],
    [btn(isToday ? '📅 Make it yesterday' : '📅 Make it today', `dt:${nonce}`), btn('🏷 Change category', `chg:${nonce}`)],
  ],
})

export const afterSave = (txId, type) => ({
  inline_keyboard: [
    [btn('↩️ Undo', `undo:${txId}`), btn(type === 'income' ? '➕ Add another' : '➖ Add another', `add:${type}`)],
    [btn('🧾 Recent', 'm:recent'), btn('💰 Balance', 'm:balance')],
  ],
})

// ── Instant save: one-tap fixes on the "Saved" message ───────────────────────
// Callbacks carry the transaction id + the category's Firestore doc id (both
// short and only ever looked up inside the verified user's own collections).
export const savedActions = (txId, alternatives, isToday, type) => ({
  inline_keyboard: [
    ...(alternatives.length ? [alternatives.map((c) => btn(`${catEmoji(c.icon)} ${c.label}`.slice(0, 24), `rc:${txId}:${c.id}`))] : []),
    [btn('🏷 Other…', `rcm:${txId}`), btn(isToday ? '📅 Yesterday' : '📅 Today', `ry:${txId}`), btn('↩️ Undo', `undo:${txId}`)],
    [btn(type === 'income' ? '➕ Add income' : '➖ Add expense', `add:${type}`)],
  ],
})

export const recategorize = (txId, categories) => ({
  inline_keyboard: [
    ...rows(categories.slice(0, 30).map((c) => btn(`${catEmoji(c.icon)} ${c.label}`.slice(0, 32), `rc:${txId}:${c.id}`)), 2),
    [btn('◀️ Back', `rv:${txId}`)],
  ],
})

export const settingsActions = (confirmOn, alertsOn = true) => ({
  inline_keyboard: [
    [btn(confirmOn ? '⚡ Save instantly (no confirm)' : '✅ Ask me to confirm first', `cfm:${confirmOn ? 'off' : 'on'}`)],
    [btn(alertsOn ? '🔕 Turn off limit alerts' : '🔔 Turn on limit alerts', `lal:${alertsOn ? 'off' : 'on'}`)],
    [btn('◀️ More', 'm:more')],
  ],
})

// ── Delete ────────────────────────────────────────────────────────────────────
export const deletePicker = (txs, label) => ({
  inline_keyboard: [
    ...txs.map((t) => [btn(label(t).slice(0, 60), `del:${t.id}`)]),
    [btn('✖️ Cancel', 'cancel')],
  ],
})

export const confirmDelete = (id) => ({
  inline_keyboard: [[btn('🗑 Delete', `delok:${id}`), btn('✖️ Keep it', 'm:recent')]],
})

// ── Reports ───────────────────────────────────────────────────────────────────
/** ◀ previous / next ▶ navigation; never offers a future period. */
export function reportNav(mode, key, currentKey, today) {
  if (mode === 'year') {
    const y = Number(key)
    const nav = [btn(`◀ ${y - 1}`, `rp:y:${y - 1}`)]
    if (y < Number(currentKey.slice(0, 4))) nav.push(btn(`${y + 1} ▶`, `rp:y:${y + 1}`))
    return { inline_keyboard: [dayShortcuts(today), nav, [btn('📊 This month', 'rp:m:now'), btn('🎯 Budget', 'm:budget')]] }
  }
  const [y, m] = key.split('-').map(Number)
  const shift = (d) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1))
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const nav = [btn(`◀ ${shortMonth(shift(-1))}`, `rp:m:${shift(-1)}`)]
  if (key < currentKey) nav.push(btn(`${shortMonth(shift(1))} ▶`, `rp:m:${shift(1)}`))
  return { inline_keyboard: [dayShortcuts(today), nav, [btn(`📅 Year ${y}`, `rp:y:${y}`), btn('🎯 Budget', 'm:budget')]] }
}

export const budgetActions = () => ({
  inline_keyboard: [[btn('📊 Report', 'rp:m:now'), btn('➖ Add expense', 'add:expense')]],
})

export const confirmUnlink = () => ({
  inline_keyboard: [[btn('Disconnect', 'unlink:yes'), btn('Keep connected', 'm:more')]],
})
