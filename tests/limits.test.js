// Unit tests for daily / weekly spending limits (src/shared/limits.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, weekRange, normalizeLimits, hasAnyLimit, limitUsage, alertKey, pendingAlerts, pruneAlertKeys } from '../src/shared/limits.js'

const TODAY = '2026-11-05' // a Thursday
const tx = (o) => ({ type: 'expense', category: 'food', date: TODAY, amount: 1, ...o })

test('weeks run Monday–Sunday, across month and year boundaries', () => {
  assert.deepEqual(weekRange('2026-11-05'), { start: '2026-11-02', end: '2026-11-08' }) // Thu
  assert.deepEqual(weekRange('2026-11-02'), { start: '2026-11-02', end: '2026-11-08' }) // Mon
  assert.deepEqual(weekRange('2026-11-08'), { start: '2026-11-02', end: '2026-11-08' }) // Sun
  assert.deepEqual(weekRange('2027-01-01'), { start: '2026-12-28', end: '2027-01-03' })
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
})

test('limits normalise: blanks / zero / negatives are "no limit"', () => {
  const l = normalizeLimits({ day: { total: 0, categories: { food: 10, x: -1, y: 'abc' } }, week: null })
  assert.deepEqual(l, { day: { total: null, categories: { food: 10 }, dates: {} }, week: { total: null, categories: {}, dates: {} } })
  assert.equal(hasAnyLimit(l), true)
  assert.equal(hasAnyLimit(normalizeLimits({})), false)
})

test('usage counts only expenses inside each period', () => {
  const rows = limitUsage(
    { day: { total: 10, categories: { food: 10 } }, week: { total: 50, categories: { food: 30 } } },
    [
      tx({ amount: 7 }),                                  // today food
      tx({ amount: 2, category: 'transport' }),           // today other
      tx({ amount: 5, date: '2026-11-03' }),              // earlier this week, food
      tx({ amount: 99, date: '2026-11-01' }),             // last week → ignored
      tx({ amount: 100, type: 'income' }),                // income never counts
      tx({ amount: 40, type: 'borrow' }),                 // borrow never counts
    ],
    TODAY
  )
  const get = (period, scope) => rows.find((r) => r.period === period && r.scope === scope)
  assert.deepEqual([get('day', 'total').spent, get('day', 'total').pct, get('day', 'total').level], [9, 90, 'warn'])
  assert.deepEqual([get('day', 'food').spent, get('day', 'food').remaining], [7, 3])
  assert.deepEqual([get('week', 'total').spent, get('week', 'total').level], [14, 'ok'])
  assert.deepEqual([get('week', 'food').spent, get('week', 'food').pct], [12, 40])
})

test('levels: 80 % warns, 100 % is over', () => {
  const at = (spent) => limitUsage({ day: { total: 10 } }, [tx({ amount: spent })], TODAY)[0].level
  assert.equal(at(7.99), 'ok')
  assert.equal(at(8), 'warn')
  assert.equal(at(10), 'over')
  assert.equal(at(12), 'over')
})

test('alerts fire once per level per period; "over" suppresses a late "warn"', () => {
  const rows = limitUsage({ day: { categories: { food: 10 } } }, [tx({ amount: 8.5 })], TODAY)
  const first = pendingAlerts(rows, [])
  assert.equal(first.length, 1)
  assert.equal(alertKey(first[0]), 'day:2026-11-05:food:warn')
  assert.equal(pendingAlerts(rows, [alertKey(first[0])]).length, 0, 'not repeated')
  const over = limitUsage({ day: { categories: { food: 10 } } }, [tx({ amount: 11 })], TODAY)
  assert.equal(pendingAlerts(over, ['day:2026-11-05:food:warn'])[0].level, 'over', 'over still alerts after warn')
  // tomorrow is a new day → new key
  const tomorrow = limitUsage({ day: { categories: { food: 10 } } }, [tx({ amount: 9, date: '2026-11-06' })], '2026-11-06')
  assert.equal(pendingAlerts(tomorrow, ['day:2026-11-05:food:warn']).length, 1)
})

test('old alert keys are pruned', () => {
  const kept = pruneAlertKeys(['day:2026-11-05:food:warn', 'week:2026-11-02:total:over', 'day:2026-10-01:food:over'], TODAY)
  assert.deepEqual(kept, ['day:2026-11-05:food:warn', 'week:2026-11-02:total:over'])
})

test('limits with dates only count (and alert) between those dates', () => {
  const doc = {
    day: { categories: { food: 10, transport: 5 }, dates: { food: { from: '2026-11-03', to: '2026-11-10' }, transport: { from: '2026-11-20' } } },
    week: { total: 30, dates: { total: { from: '2026-11-04', to: '2026-11-30' } } },
  }
  const txs = [tx({ amount: 9 }), tx({ amount: 4, category: 'transport' }), tx({ amount: 50, date: '2026-11-03' })]
  const rows = limitUsage(doc, txs, TODAY)
  assert.deepEqual(rows.map((r) => `${r.period}:${r.scope}`), ['day:food', 'week:total'], 'upcoming transport limit is left out')
  assert.equal(rows[0].level, 'warn')
  assert.deepEqual([rows[0].from, rows[0].to], ['2026-11-03', '2026-11-10'])
  // weekly limit starts on the 4th → the $50 on the 3rd doesn't count
  assert.equal(rows[1].spent, 13)
  const all = limitUsage(doc, txs, TODAY, { includeInactive: true })
  const tr = all.find((r) => r.scope === 'transport')
  assert.deepEqual([tr.status, tr.spent, tr.level], ['upcoming', 0, 'ok'])
  assert.equal(pendingAlerts(all, []).length, 1, 'only the active food limit alerts')
  // after the end date it stops
  assert.equal(limitUsage(doc, [tx({ amount: 99, date: '2026-11-11' })], '2026-11-11').filter((r) => r.scope === 'food').length, 0)
})

test('dates are cleaned: swapped / invalid / orphan ranges', () => {
  const l = normalizeLimits({ day: { total: 5, categories: {}, dates: { total: { from: '2026-11-20', to: '2026-11-01' }, food: { from: '2026-11-01' }, x: { from: 'nope' } } } })
  assert.deepEqual(l.day.dates, { total: { from: '2026-11-01', to: '2026-11-20' } })
})
