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
  more: '☰ More',
}
export const mainKeyboard = () => ({
  keyboard: [
    [{ text: KEYS.expense }, { text: KEYS.income }],
    [{ text: KEYS.balance }, { text: KEYS.report }, { text: KEYS.recent }],
    [{ text: KEYS.budget }, { text: KEYS.more }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: 'Type 5 coffee or +100 salary',
})

// ── Inline menus ──────────────────────────────────────────────────────────────
export const moreMenu = () => ({
  inline_keyboard: [
    [btn('📥 Income', 'sum:income:month'), btn('📤 Expenses', 'sum:expense:month')],
    [btn('🎯 Budgets', 'm:budget'), btn('🗑 Delete', 'm:delete')],
    [btn('📅 This year', 'rp:y:now'), btn('⚙️ Settings', 'm:settings')],
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

export const recentActions = () => ({
  inline_keyboard: [[btn('🗑 Delete one', 'm:delete'), btn('➖ Add expense', 'add:expense')]],
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

export const settingsActions = (confirmOn) => ({
  inline_keyboard: [
    [btn(confirmOn ? '⚡ Save instantly (no confirm)' : '✅ Ask me to confirm first', `cfm:${confirmOn ? 'off' : 'on'}`)],
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
export function reportNav(mode, key, currentKey) {
  if (mode === 'year') {
    const y = Number(key)
    const nav = [btn(`◀ ${y - 1}`, `rp:y:${y - 1}`)]
    if (y < Number(currentKey.slice(0, 4))) nav.push(btn(`${y + 1} ▶`, `rp:y:${y + 1}`))
    return { inline_keyboard: [nav, [btn('📊 This month', 'rp:m:now'), btn('🎯 Budget', 'm:budget')]] }
  }
  const [y, m] = key.split('-').map(Number)
  const shift = (d) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1))
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const nav = [btn(`◀ ${shortMonth(shift(-1))}`, `rp:m:${shift(-1)}`)]
  if (key < currentKey) nav.push(btn(`${shortMonth(shift(1))} ▶`, `rp:m:${shift(1)}`))
  return { inline_keyboard: [nav, [btn(`📅 Year ${y}`, `rp:y:${y}`), btn('🎯 Budget', 'm:budget')]] }
}

export const budgetActions = () => ({
  inline_keyboard: [[btn('📊 Report', 'rp:m:now'), btn('➖ Add expense', 'add:expense')]],
})

export const confirmUnlink = () => ({
  inline_keyboard: [[btn('Disconnect', 'unlink:yes'), btn('Keep connected', 'm:more')]],
})
