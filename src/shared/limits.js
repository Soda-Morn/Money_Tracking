/**
 * Daily & weekly spending limits — pure rules shared by the Vue app and the
 * Telegram Worker (so both compute "spent / left" and alerts identically).
 *
 * Stored at users/{uid}/settings/spendingLimits:
 *   { day:  { total: number|null, categories: { [categoryValue]: number } },
 *     week: { total: number|null, categories: { ... } } }
 *
 * Rules:
 *  - only EXPENSES count (income / borrow / payback never do)
 *  - "day" = the user's local calendar day; "week" = Monday–Sunday
 *  - optional active dates per limit: day.dates / week.dates = { [scope]: { from, to } }
 *    (e.g. Food $10 a day only from 2026-11-05 to 2026-11-20)
 *  - alert levels: 'warn' at ≥ 80 %, 'over' at ≥ 100 %
 *  - an alert key is unique per period instance, so each limit alerts at most
 *    once per level per day / week
 */
import { dayDiff } from './finance.js'

export const PERIODS = ['day', 'week']
export const WARN_PCT = 80

const amt = (n) => Number(n) || 0
const round2 = (n) => Math.round(n * 100) / 100

/** 'YYYY-MM-DD' shifted by n days (pure UTC arithmetic — no timezone drift). */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Monday–Sunday week containing `date`. */
export function weekRange(date) {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const start = addDays(date, -((dow + 6) % 7))
  return { start, end: addDays(start, 6) }
}

export const periodRangeFor = (period, today) =>
  period === 'week' ? weekRange(today) : { start: today, end: today }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const cleanRange = (r) => {
  const from = DATE_RE.test(r?.from || '') ? r.from : null
  const to = DATE_RE.test(r?.to || '') ? r.to : null
  if (!from && !to) return null
  return from && to && to < from ? { from: to, to: from } : { from, to }
}

/**
 * Normalise a stored limits doc (missing parts → empty).
 * Optional active dates per limit live in `dates`: { [scope]: { from, to } }
 * (scope = 'total' or a category value). No dates = every day / every week.
 */
export function normalizeLimits(doc) {
  const part = (p) => {
    const total = amt(p?.total) > 0 ? amt(p.total) : null
    const categories = Object.fromEntries(Object.entries(p?.categories || {}).filter(([, v]) => amt(v) > 0).map(([k, v]) => [k, amt(v)]))
    const dates = {}
    for (const [scope, r] of Object.entries(p?.dates || {})) {
      const range = cleanRange(r)
      if (range && (scope === 'total' ? total : categories[scope])) dates[scope] = range
    }
    return { total, categories, dates }
  }
  return { day: part(doc?.day), week: part(doc?.week) }
}

/** 'active' | 'upcoming' | 'ended' for a date range on `today` (no range = always active). */
export function rangeStatus(range, today) {
  if (!range) return 'active'
  if (range.from && today < range.from) return 'upcoming'
  if (range.to && today > range.to) return 'ended'
  return 'active'
}

export const hasAnyLimit = (limits) =>
  PERIODS.some((p) => limits[p].total || Object.keys(limits[p].categories).length)

const levelOf = (pct) => (pct >= 100 ? 'over' : pct >= WARN_PCT ? 'warn' : 'ok')

/**
 * Usage of every configured limit for `today`.
 * `transactions` may contain anything — only expenses inside each period count.
 * A limit with active dates only counts while today is inside them, and a
 * weekly limit only counts the days of this week that fall inside its dates.
 * Returns [{ period, scope ('total' | categoryValue), limit, spent, remaining,
 *            pct, level, periodStart, from, to, status }]
 * Inactive (upcoming / ended) limits are left out unless `includeInactive`;
 * they then come back with status 'upcoming' | 'ended', spent 0, level 'ok'.
 */
export function limitUsage(limitsDoc, transactions, today, { includeInactive = false } = {}) {
  const limits = normalizeLimits(limitsDoc)
  const out = []
  for (const period of PERIODS) {
    const { start, end } = periodRangeFor(period, today)
    const expenses = transactions.filter((t) => t.type === 'expense' && t.date >= start && t.date <= end)
    const add = (scope, limit, filter) => {
      const range = limits[period].dates[scope] || null
      const status = rangeStatus(range, today)
      const base = { period, scope, limit, periodStart: start, from: range?.from || null, to: range?.to || null, status }
      if (status !== 'active') {
        if (includeInactive) out.push({ ...base, spent: 0, remaining: limit, pct: 0, level: 'ok' })
        return
      }
      const lo = range?.from && range.from > start ? range.from : start
      const hi = range?.to && range.to < end ? range.to : end
      const spent = expenses.filter((t) => t.date >= lo && t.date <= hi && filter(t)).reduce((s, t) => s + amt(t.amount), 0)
      const exact = limit > 0 ? (spent / limit) * 100 : 0
      // level from the EXACT ratio (79.9 % must not warn); pct is rounded for display only
      out.push({ ...base, spent: round2(spent), remaining: round2(limit - spent), pct: Math.round(exact), level: levelOf(exact) })
    }
    if (limits[period].total) add('total', limits[period].total, () => true)
    for (const [cat, limit] of Object.entries(limits[period].categories)) add(cat, limit, (t) => t.category === cat)
  }
  return out
}

/** Unique, stable key for one alert (period instance + scope + level). */
export const alertKey = (row) => `${row.period}:${row.periodStart}:${row.scope}:${row.level}`

/**
 * Alerts that should fire now: rows at warn/over whose key hasn't been sent.
 * If a limit is already over, the 'warn' alert is skipped (no double message).
 */
export function pendingAlerts(rows, sentKeys = []) {
  const sent = new Set(sentKeys)
  return rows
    .filter((r) => r.level !== 'ok' && (r.status ?? 'active') === 'active')
    .filter((r) => !sent.has(alertKey(r)))
    .filter((r) => !(r.level === 'warn' && sent.has(alertKey({ ...r, level: 'over' }))))
}

/** Keep only keys for periods that can still matter (this week / today). */
export function pruneAlertKeys(keys, today) {
  const weekStart = weekRange(today).start
  return keys.filter((k) => {
    const [, start] = k.split(':')
    return start && dayDiff(start, today) <= 7 && start >= addDays(weekStart, -7)
  })
}
