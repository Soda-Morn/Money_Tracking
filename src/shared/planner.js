/**
 * Expense Planner — pure, framework-free business rules.
 *
 * Shared by the Vue app (and ready for the Telegram Worker) so every interface
 * computes plans the same way. No Vue, no Firebase, no DOM.
 *
 * Core financial rules (enforced here and in usePlanner):
 *  - Planned expenses NEVER affect real balances or reports — only a confirmed
 *    payment creates a real transaction (in users/{uid}/transactions).
 *  - Cancelled plans are excluded from active planned spending.
 *  - Pending plans are not actual spending.
 *  - Paid plans use the REAL transaction amount for "actual".
 *  - "Overdue" is derived (pending + due date in the past), never stored.
 */
import { daysInMonth, toDateString } from './finance.js'

export const STATUSES = ['pending', 'paid', 'cancelled']
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']

const amt = (n) => Number(n) || 0
const round2 = (n) => Math.round(n * 100) / 100

// ── Months & dates ────────────────────────────────────────────────────────────
export const monthOf = (dateStr) => String(dateStr || '').slice(0, 7)

/** 'YYYY-MM' shifted by n months. */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Same day-of-month in another month, clamped (Jan 31 → Feb 28/29). */
export function shiftDateToMonth(dateStr, targetMonth) {
  const day = Number(String(dateStr).slice(8, 10)) || 1
  const [y, m] = targetMonth.split('-').map(Number)
  return toDateString(y, m - 1, Math.min(day, daysInMonth(y, m - 1)))
}

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))

/** Display status: pending plans whose due date has passed are "overdue". */
export function displayStatus(plan, today) {
  if (plan.status === 'pending' && plan.dueDate && plan.dueDate < today) return 'overdue'
  return plan.status || 'pending'
}

// ── Validation (same rules for every interface) ───────────────────────────────
export function validatePlan(p) {
  const errors = {}
  if (!String(p.name || '').trim()) errors.name = 'name_required'
  else if (String(p.name).trim().length > 60) errors.name = 'name_too_long'
  if (!(amt(p.amount) > 0)) errors.amount = 'amount_required'
  if (!p.category) errors.category = 'category_required'
  if (!isValidDate(p.dueDate)) errors.dueDate = 'date_required'
  else if (p.month && monthOf(p.dueDate) !== p.month) errors.dueDate = 'date_outside_month'
  if (p.frequency && p.frequency !== 'none' && !FREQUENCIES.includes(p.frequency)) errors.frequency = 'invalid_frequency'
  return errors
}

// ── Recurrence ────────────────────────────────────────────────────────────────
/**
 * Due dates of a recurring series that fall inside `month`.
 * Only dates on/after the series anchor (first due date); months with fewer
 * days clamp to their last day; monthly/quarterly/yearly keep the anchor's day.
 */
export function occurrencesInMonth(series, month) {
  const anchor = series.anchorDate
  if (!isValidDate(anchor) || month < monthOf(anchor)) return []
  if (series.endMonth && month > series.endMonth) return []
  const [y, m] = month.split('-').map(Number)
  const last = daysInMonth(y, m - 1)
  const monthsBetween = (y - Number(anchor.slice(0, 4))) * 12 + (m - Number(anchor.slice(5, 7)))

  switch (series.frequency) {
    case 'monthly':
      return [shiftDateToMonth(anchor, month)]
    case 'quarterly':
      return monthsBetween % 3 === 0 ? [shiftDateToMonth(anchor, month)] : []
    case 'yearly':
      return monthsBetween % 12 === 0 ? [shiftDateToMonth(anchor, month)] : []
    case 'weekly':
    case 'daily': {
      const step = series.frequency === 'weekly' ? 7 : 1
      const start = Date.UTC(y, m - 1, 1)
      const end = Date.UTC(y, m - 1, last)
      const a = Date.parse(anchor + 'T00:00:00Z')
      // first occurrence on/after the start of this month
      let t = a >= start ? a : a + Math.ceil((start - a) / (step * 86400000)) * step * 86400000
      const out = []
      for (; t <= end; t += step * 86400000) out.push(new Date(t).toISOString().slice(0, 10))
      return out
    }
    default:
      return []
  }
}

/** Deterministic id → the same occurrence can never be created twice. */
export const occurrenceId = (seriesId, dueDate) => `${seriesId}_${dueDate}`

// ── Month summary ─────────────────────────────────────────────────────────────
/**
 * @param plans    planned expenses of ONE month
 * @param monthDoc { incomes:[{amount}], savings:[{amount}] } or null
 */
export function monthSummary(plans, monthDoc, today) {
  const active = plans.filter((p) => p.status !== 'cancelled')
  const expectedIncome = round2((monthDoc?.incomes || []).reduce((s, i) => s + amt(i.amount), 0))
  const plannedExpenses = round2(active.reduce((s, p) => s + amt(p.amount), 0))
  const plannedSavings = round2((monthDoc?.savings || []).reduce((s, i) => s + amt(i.amount), 0))
  const remaining = round2(expectedIncome - plannedExpenses - plannedSavings)
  const count = { pending: 0, paid: 0, overdue: 0, cancelled: 0 }
  plans.forEach((p) => { count[displayStatus(p, today)]++ })
  const stillToPay = round2(active.filter((p) => p.status === 'pending').reduce((s, p) => s + amt(p.amount), 0))
  return {
    expectedIncome,
    plannedExpenses,
    plannedSavings,
    remaining,
    allocatedPct: expectedIncome > 0 ? Math.round(((plannedExpenses + plannedSavings) / expectedIncome) * 1000) / 10 : null,
    stillToPay,
    count,
  }
}

// ── Planned vs actual ─────────────────────────────────────────────────────────
/**
 * Compare plans with what really happened.
 *  - paid      → actual = the linked transaction's amount (falls back to the
 *                recorded actualAmount if the transaction list isn't loaded)
 *  - pending   → not spent yet, listed separately, not counted as actual
 *  - cancelled → excluded (an unspent cancelled plan is NOT "savings")
 * difference = planned − actual  (positive = spent less than planned)
 */
export function planVsActual(plans, transactionsById = new Map()) {
  const rows = []
  const pending = []
  let missingTransactions = 0
  for (const p of plans) {
    if (p.status === 'cancelled') continue
    if (p.status !== 'paid') { pending.push(p); continue }
    const tx = p.transactionId ? transactionsById.get(p.transactionId) : null
    if (p.transactionId && transactionsById.size && !tx) missingTransactions++
    const actual = tx ? amt(tx.amount) : (transactionsById.size ? 0 : amt(p.actualAmount))
    rows.push({ id: p.id, name: p.name, category: p.category, planned: amt(p.amount), actual, difference: round2(amt(p.amount) - actual), transactionMissing: !!(p.transactionId && transactionsById.size && !tx) })
  }
  const totalPlanned = round2(rows.reduce((s, r) => s + r.planned, 0))
  const totalActual = round2(rows.reduce((s, r) => s + r.actual, 0))
  return {
    rows,
    pending,
    pendingTotal: round2(pending.reduce((s, p) => s + amt(p.amount), 0)),
    totalPlanned,
    totalActual,
    difference: round2(totalPlanned - totalActual),
    missingTransactions,
  }
}

// ── Insights (only ever computed from real data) ──────────────────────────────
/**
 * Returns [{ key, params }] — the UI translates them. Empty when there is
 * nothing meaningful to say.
 */
export function plannerInsights(plans, monthDoc, previousPlans, today) {
  const out = []
  const s = monthSummary(plans, monthDoc, today)
  const active = plans.filter((p) => p.status !== 'cancelled')

  if (s.expectedIncome > 0) {
    out.push({ key: 'planned_of_income', params: { planned: s.plannedExpenses + s.plannedSavings, income: s.expectedIncome } })
    if (s.remaining > 0) out.push({ key: 'unallocated', params: { amount: s.remaining } })
    else if (s.remaining < 0) out.push({ key: 'over_allocated', params: { amount: -s.remaining } })
  }
  if (active.length) {
    const largest = [...active].sort((a, b) => amt(b.amount) - amt(a.amount))[0]
    out.push({ key: 'largest', params: { name: largest.name, amount: amt(largest.amount) } })
  }
  if (s.count.overdue) out.push({ key: 'overdue', params: { count: s.count.overdue } })

  const prevActive = (previousPlans || []).filter((p) => p.status !== 'cancelled')
  if (prevActive.length && active.length) {
    const prevTotal = round2(prevActive.reduce((t, p) => t + amt(p.amount), 0))
    const diff = round2(s.plannedExpenses - prevTotal)
    if (diff < 0) out.push({ key: 'less_than_last', params: { amount: -diff } })
    else if (diff > 0) out.push({ key: 'more_than_last', params: { amount: diff } })

    // Biggest category increase vs last month
    const byCat = (list) => list.reduce((m, p) => m.set(p.category, (m.get(p.category) || 0) + amt(p.amount)), new Map())
    const now = byCat(active)
    const before = byCat(prevActive)
    let top = null
    for (const [cat, total] of now) {
      const inc = total - (before.get(cat) || 0)
      if (before.has(cat) && inc > 0 && (!top || inc > top.inc)) top = { cat, inc }
    }
    if (top) out.push({ key: 'category_up', params: { category: top.cat, amount: round2(top.inc) } })
  }
  return out
}

/** Sort helper for lists: overdue first, then by due date, then name. */
export function sortPlans(plans, today, by = 'due') {
  const rank = { overdue: 0, pending: 1, paid: 2, cancelled: 3 }
  const list = [...plans]
  if (by === 'amount') return list.sort((a, b) => amt(b.amount) - amt(a.amount))
  return list.sort((a, b) =>
    (rank[displayStatus(a, today)] - rank[displayStatus(b, today)])
    || String(a.dueDate).localeCompare(String(b.dueDate))
    || String(a.name).localeCompare(String(b.name)))
}
