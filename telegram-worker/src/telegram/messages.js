import { USD_TO_KHR } from '../../../src/shared/finance.js'

/** Escape user-controlled text for Telegram HTML parse mode. */
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Money in the user's display currency (amounts are stored in USD, like the app). */
export function money(usd, currency = 'USD') {
  const n = Number(usd) || 0
  if (currency === 'KHR') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KHR', maximumFractionDigits: 0 }).format(n * USD_TO_KHR)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
export const signedMoney = (usd, currency) => `${usd < 0 ? '−' : '+'}${money(Math.abs(usd), currency)}`

/** '2026-11-05' → '5 November 2026' (no timezone shift: pure UTC formatting). */
export function longDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export function monthTitle(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export const shortMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

/** Today's date ('YYYY-MM-DD') in the user's timezone. */
export function todayIn(timeZone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  }
}

/** The day before a 'YYYY-MM-DD' date. */
export function dayBefore(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

export const TYPE_LABEL = { income: 'Income', expense: 'Expense', borrow: 'Borrow', payback: 'Payback' }
export const TYPE_ICON = { income: '➕', expense: '➖', borrow: '🤝', payback: '↩️' }

// The app stores Lucide icon keys for categories (src/icons). Telegram can't
// show those, so map each key to the closest emoji. Legacy emoji icons pass through.
const ICON_EMOJI = {
  utensils: '🍽', pizza: '🍕', coffee: '☕', 'cup-soda': '🥤', beer: '🍺', 'cake-slice': '🍰', sandwich: '🥪',
  apple: '🍎', 'shopping-cart': '🛒', car: '🚗', bus: '🚌', bike: '🚲', plane: '✈️', 'train-front': '🚆',
  fuel: '⛽', ship: '🚢', 'car-taxi-front': '🚕', 'shopping-bag': '🛍', shirt: '👕', gem: '💎', glasses: '👓',
  footprints: '👟', house: '🏠', lightbulb: '💡', zap: '⚡', droplets: '💧', wifi: '📶', smartphone: '📱',
  receipt: '🧾', 'credit-card': '💳', 'key-round': '🔑', 'file-text': '📄', 'heart-pulse': '🩺', pill: '💊',
  stethoscope: '🩺', dumbbell: '🏋️', hospital: '🏥', clapperboard: '🎬', 'gamepad-2': '🎮', music: '🎵',
  ticket: '🎟', tv: '📺', 'party-popper': '🎉', dices: '🎲', drama: '🎭', 'book-open': '📖',
  'graduation-cap': '🎓', pencil: '✏️', laptop: '💻', monitor: '🖥', microscope: '🔬', briefcase: '💼',
  banknote: '💵', 'trending-up': '📈', landmark: '🏦', coins: '🪙', 'hand-coins': '🤲', handshake: '🤝',
  'piggy-bank': '🐷', wallet: '👛', gift: '🎁', star: '⭐', heart: '❤️', sparkles: '✨', flame: '🔥',
  trophy: '🏆', target: '🎯', leaf: '🌿', dog: '🐶', cat: '🐱', baby: '👶', tag: '🏷', globe: '🌍',
  umbrella: '☂️', wrench: '🔧', scissors: '✂️', shield: '🛡', 'tree-palm': '🌴', guitar: '🎸', camera: '📷',
  waves: '🌊', rocket: '🚀', palette: '🎨', rainbow: '🌈', clover: '🍀', luggage: '🧳', cake: '🎂', 'flower-2': '🌸',
}
export function catEmoji(icon) {
  if (!icon) return '🏷'
  if (ICON_EMOJI[icon]) return ICON_EMOJI[icon]
  return /^[\x00-\x7F]+$/.test(icon) ? '🏷' : icon // non-ASCII = a legacy emoji icon
}

export const ERRORS = {
  invalid_amount: '❌ Invalid amount.\nPlease enter a valid number greater than 0, e.g. <code>5.50</code>.',
  too_many_decimals: '❌ Invalid amount.\nUse at most 2 decimal places, e.g. <code>12.50</code>.',
  amount_too_large: '❌ That amount is too large.',
  description_too_long: '❌ Description is too long (max 120 characters).',
  missing_args: '❌ Missing details.',
  missing_category: '❌ Please add a category after the amount.',
  generic: '⚠️ Something went wrong on our side. Please try again in a moment.',
  session_expired: '⌛ This confirmation has expired. Please start again.',
}

export const HELP = `<b>How to use the bot</b>

<b>Fastest way to add</b> — just type, it's saved instantly:
• <code>5</code> → expense in your usual category
• <code>5 coffee</code> → category learned from your history
• <code>12.50 food lunch</code> → expense in “food”, note “lunch”
• <code>+100</code> or <code>+100 salary</code> → income
Wrong category? Tap the right one under “Saved”. ↩️ Undo is always there.
Prefer a confirm step? ☰ More → ⚙️ Settings. Amounts are in USD, like the app.

<b>Buttons</b> at the bottom of the chat:
➖ Expense · ➕ Income · 💰 Balance · 📊 Report · 🧾 Recent · 🎯 Budget · 🗓 Plan · ☰ More

<b>Expense Planner</b> 🗓 — plan before payday (never changes your balance)
/plan — this month: income, planned, left over, still to pay
/planadd 120 Rent 10 — plan $120 “Rent” due on the 10th
/plannext 120 Rent 10 — same, for next month
Tap a plan → ✅ Mark paid (adds the real expense) or ⊘ Cancel

<b>Commands</b> (optional)
/today · /yesterday · /day 2026-11-03 — what you spent on a day
/balance · /report · /report_year · /recent · /delete
/budget · /budget_food · /budget_remaining
/income · /expense (add <code>_today</code> for today)
/addexpense 5 Food Lunch · /addincome 100 Salary
/menu · /cancel · /unlink`

export const NOT_LINKED = `🔒 This Telegram account isn't connected yet.

1. Open Smart Money Tracking and sign in
2. Go to <b>Settings → Telegram</b> and tap <b>Connect Telegram</b>
3. Tap <b>Open Telegram</b> (or send the <code>/start CODE</code> it shows)

Codes expire after 5 minutes and work once.`
