/**
 * Shared, framework-free financial calculations.
 *
 * Used by BOTH the Vue app and the Telegram Cloudflare Worker so the two
 * interfaces always produce identical numbers from the same Firestore data.
 * Keep this file dependency-free (no Vue, no Firebase, no DOM).
 *
 * Conventions (match how the app stores data):
 *  - amounts are stored in USD as numbers (Number() is applied defensively)
 *  - dates are local 'YYYY-MM-DD' strings, so string comparison == date order
 */

export const USD_TO_KHR = 4013

const amountOf = (t) => Number(t?.amount) || 0

/** Sum of one transaction type. */
export const sumByType = (transactions, type) =>
  transactions.reduce((s, t) => (t.type === type ? s + amountOf(t) : s), 0)

/** Income, expense, borrow, payback and balance (income − expense + borrow − payback). */
export function totals(transactions) {
  const income = sumByType(transactions, 'income')
  const expense = sumByType(transactions, 'expense')
  const borrow = sumByType(transactions, 'borrow')
  const payback = sumByType(transactions, 'payback')
  return { income, expense, borrow, payback, balance: income - expense + borrow - payback }
}

// ── Dates (pure string / calendar arithmetic — no timezone surprises) ─────────
const pad = (n) => String(n).padStart(2, '0')
export const toDateString = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`
export const monthKeyOf = (dateStr) => dateStr.slice(0, 7)

/** Number of days in a 0-based month. */
export const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

/** Whole calendar days between two 'YYYY-MM-DD' strings (b − a). */
export function dayDiff(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/** Inclusive date range for a period containing (year, month0). */
export function periodRange(mode, year, month0) {
  if (mode === 'year') return { start: toDateString(year, 0, 1), end: toDateString(year, 11, 31) }
  if (mode === 'quarter') {
    const q = Math.floor(month0 / 3) * 3
    return { start: toDateString(year, q, 1), end: toDateString(year, q + 2, daysInMonth(year, q + 2)) }
  }
  return { start: toDateString(year, month0, 1), end: toDateString(year, month0, daysInMonth(year, month0)) }
}

/** The period immediately before (same length) — previous month / quarter / year. */
export function previousPeriodRange(mode, year, month0) {
  const shift = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1
  const d = new Date(Date.UTC(year, month0 - shift, 1))
  return periodRange(mode, d.getUTCFullYear(), d.getUTCMonth())
}

export const inRange = (t, range) => !!t?.date && t.date >= range.start && t.date <= range.end

// ── Report metrics (same rules the Analytics page shows) ──────────────────────

/** Savings rate % (rounded) or null when there is no income. */
export const savingsRate = (income, expense) =>
  income ? Math.round(((income - expense) / income) * 100) : null

/**
 * Average daily spend over the days of the period that have elapsed.
 * `today` is the user's local 'YYYY-MM-DD'. Null if the period hasn't started.
 */
export function avgDailySpend(expense, range, today) {
  if (range.start > today) return null
  const effectiveEnd = range.end < today ? range.end : today
  const days = Math.max(1, dayDiff(range.start, effectiveEnd) + 1)
  return expense / days
}

/** % change of expense vs the previous period (rounded) or null when no baseline. */
export const percentChange = (current, previous) =>
  previous ? Math.round(((current - previous) / previous) * 100) : null

/** Expense categories ranked by amount, highest first: [{ category, amount }]. */
export function expenseByCategory(transactions) {
  const map = {}
  transactions.forEach((t) => {
    if (t.type === 'expense') map[t.category] = (map[t.category] || 0) + amountOf(t)
  })
  return Object.entries(map)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/** Full period report used by the Telegram bot (and matching the Analytics page). */
export function periodReport(allTransactions, mode, year, month0, today) {
  const range = periodRange(mode, year, month0)
  const prevRange = previousPeriodRange(mode, year, month0)
  const current = allTransactions.filter((t) => inRange(t, range))
  const previous = allTransactions.filter((t) => inRange(t, prevRange))
  const income = sumByType(current, 'income')
  const expense = sumByType(current, 'expense')
  const prevExpense = sumByType(previous, 'expense')
  const categories = expenseByCategory(current)
  return {
    range,
    prevRange,
    income,
    expense,
    net: income - expense,
    savingsRate: savingsRate(income, expense),
    avgDailySpend: avgDailySpend(expense, range, today),
    prevExpense,
    expenseChange: percentChange(expense, prevExpense),
    topCategory: categories[0] || null,
    categories,
    count: current.length,
  }
}

// ── Budgets ───────────────────────────────────────────────────────────────────

/** Promote legacy `{ [month]: number }` budget entries to `{ total, categories }`. */
export const normalizeBudgets = (data = {}) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === 'number' ? { total: v, categories: {} } : { total: v?.total ?? 0, categories: v?.categories ?? {} },
    ])
  )

const usage = (limit, spent) => ({
  limit,
  spent,
  remaining: limit - spent,
  // Raw percentage (can exceed 100). UIs cap it for progress bars.
  pct: limit > 0 ? Math.round((spent / limit) * 100) : null,
})

/**
 * Budget usage for one month. `monthTransactions` = that month's transactions.
 * Returns null when no budget is set for the month.
 */
export function budgetUsage(budgets, monthKey, monthTransactions) {
  const entry = normalizeBudgets(budgets)[monthKey]
  if (!entry) return null
  const spentByCat = Object.fromEntries(expenseByCategory(monthTransactions).map((c) => [c.category, c.amount]))
  return {
    monthKey,
    total: entry.total ? usage(Number(entry.total), sumByType(monthTransactions, 'expense')) : null,
    categories: Object.entries(entry.categories).map(([category, limit]) => ({
      category,
      ...usage(Number(limit), spentByCat[category] || 0),
    })),
  }
}
