// Unit tests for the Expense Planner rules (src/shared/planner.js).
// Run: npm test   (Node's built-in test runner — no extra dependencies)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonths, shiftDateToMonth, displayStatus, validatePlan, occurrencesInMonth, occurrenceId,
  monthSummary, planVsActual, plannerInsights, sortPlans,
} from '../src/shared/planner.js'

const TODAY = '2026-11-15'
const plan = (o) => ({ id: o.id || o.name, status: 'pending', category: 'bills', month: '2026-11', dueDate: '2026-11-20', amount: 10, ...o })

test('month arithmetic and clamping to shorter months', () => {
  assert.equal(addMonths('2026-11', 1), '2026-12')
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.equal(shiftDateToMonth('2026-01-31', '2026-02'), '2026-02-28')
  assert.equal(shiftDateToMonth('2028-01-31', '2028-02'), '2028-02-29') // leap year
  assert.equal(shiftDateToMonth('2026-03-31', '2026-04'), '2026-04-30')
  assert.equal(shiftDateToMonth('2026-03-15', '2026-04'), '2026-04-15')
})

test('overdue is derived, never stored', () => {
  assert.equal(displayStatus(plan({ dueDate: '2026-11-10' }), TODAY), 'overdue')
  assert.equal(displayStatus(plan({ dueDate: '2026-11-15' }), TODAY), 'pending') // due today ≠ overdue
  assert.equal(displayStatus(plan({ dueDate: '2026-11-10', status: 'paid' }), TODAY), 'paid')
  assert.equal(displayStatus(plan({ dueDate: '2026-11-10', status: 'cancelled' }), TODAY), 'cancelled')
})

test('validation: required fields, positive amount, date inside the planned month', () => {
  assert.deepEqual(validatePlan({ name: 'Rent', amount: 120, category: 'bills', month: '2026-11', dueDate: '2026-11-10' }), {})
  const e = validatePlan({ name: ' ', amount: 0, category: '', month: '2026-11', dueDate: '2026-12-01' })
  assert.deepEqual(Object.keys(e).sort(), ['amount', 'category', 'dueDate', 'name'])
  assert.equal(e.dueDate, 'date_outside_month')
  assert.equal(validatePlan({ name: 'x', amount: -5, category: 'c', dueDate: '2026-11-01' }).amount, 'amount_required')
  assert.equal(validatePlan({ name: 'x', amount: 5, category: 'c', dueDate: 'nope' }).dueDate, 'date_required')
})

test('recurrence: monthly keeps the day and clamps short months', () => {
  const s = { frequency: 'monthly', anchorDate: '2026-01-31' }
  assert.deepEqual(occurrencesInMonth(s, '2026-01'), ['2026-01-31'])
  assert.deepEqual(occurrencesInMonth(s, '2026-02'), ['2026-02-28'])
  assert.deepEqual(occurrencesInMonth(s, '2026-04'), ['2026-04-30'])
  assert.deepEqual(occurrencesInMonth(s, '2025-12'), [], 'never before the first due date')
})

test('recurrence: quarterly, yearly, weekly, daily and end month', () => {
  const q = { frequency: 'quarterly', anchorDate: '2026-01-15' }
  assert.deepEqual(occurrencesInMonth(q, '2026-04'), ['2026-04-15'])
  assert.deepEqual(occurrencesInMonth(q, '2026-05'), [])
  const y = { frequency: 'yearly', anchorDate: '2024-02-29' }
  assert.deepEqual(occurrencesInMonth(y, '2025-02'), ['2025-02-28'])
  assert.deepEqual(occurrencesInMonth(y, '2025-03'), [])
  const w = { frequency: 'weekly', anchorDate: '2026-10-27' } // a Tuesday
  assert.deepEqual(occurrencesInMonth(w, '2026-11'), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'])
  const d = { frequency: 'daily', anchorDate: '2026-11-28' }
  assert.deepEqual(occurrencesInMonth(d, '2026-11'), ['2026-11-28', '2026-11-29', '2026-11-30'])
  assert.equal(occurrencesInMonth(d, '2026-12').length, 31)
  assert.deepEqual(occurrencesInMonth({ ...q, endMonth: '2026-03' }, '2026-04'), [])
})

test('recurrence ids are deterministic (duplicates impossible)', () => {
  assert.equal(occurrenceId('s1', '2026-11-03'), occurrenceId('s1', '2026-11-03'))
  assert.notEqual(occurrenceId('s1', '2026-11-03'), occurrenceId('s1', '2026-11-10'))
})

test('month summary matches the spec example: 600 income, 365 spend, 100 savings → 135 left', () => {
  const plans = [
    plan({ name: 'Rent', amount: 120 }), plan({ name: 'Internet', amount: 15, status: 'paid' }),
    plan({ name: 'Electricity', amount: 30 }), plan({ name: 'Food', amount: 100 }),
    plan({ name: 'Transport', amount: 50 }), plan({ name: 'Shopping', amount: 50 }),
    plan({ name: 'Old gym', amount: 40, status: 'cancelled' }), // excluded
  ]
  const s = monthSummary(plans, { incomes: [{ amount: 600 }], savings: [{ amount: 100 }] }, TODAY)
  assert.equal(s.expectedIncome, 600)
  assert.equal(s.plannedExpenses, 365)
  assert.equal(s.plannedSavings, 100)
  assert.equal(s.remaining, 135)
  assert.equal(s.allocatedPct, 77.5)
  assert.equal(s.stillToPay, 350)
  assert.equal(s.count.cancelled, 1)
})

test('summary without expected income has no allocation %', () => {
  const s = monthSummary([plan({ amount: 50 })], null, TODAY)
  assert.equal(s.allocatedPct, null)
  assert.equal(s.remaining, -50)
})

test('plan vs actual: paid uses the real transaction, pending/cancelled are not spending', () => {
  const plans = [
    plan({ id: 'rent', name: 'Rent', amount: 120, status: 'paid', transactionId: 'plan_rent', actualAmount: 999 }),
    plan({ id: 'food', name: 'Food', amount: 100, status: 'paid', transactionId: 'plan_food' }),
    plan({ id: 'elec', name: 'Electricity', amount: 30, status: 'paid', transactionId: 'plan_elec' }),
    plan({ id: 'shop', name: 'Shopping', amount: 50, status: 'cancelled' }),
    plan({ id: 'tv', name: 'TV', amount: 20 }),
  ]
  const txs = new Map([['plan_rent', { amount: 120 }], ['plan_food', { amount: 85 }], ['plan_elec', { amount: 35 }]])
  const r = planVsActual(plans, txs)
  assert.deepEqual(r.rows.map((x) => [x.name, x.planned, x.actual, x.difference]), [
    ['Rent', 120, 120, 0], ['Food', 100, 85, 15], ['Electricity', 30, 35, -5],
  ])
  assert.equal(r.totalPlanned, 250)
  assert.equal(r.totalActual, 240)
  assert.equal(r.difference, 10)          // cancelled Shopping is NOT counted as "saved"
  assert.equal(r.pendingTotal, 20)
  assert.equal(r.pending.length, 1)
})

test('plan vs actual flags a paid plan whose transaction was deleted', () => {
  const r = planVsActual([plan({ id: 'a', status: 'paid', transactionId: 'plan_a', amount: 10 })], new Map([['other', { amount: 1 }]]))
  assert.equal(r.missingTransactions, 1)
  assert.equal(r.rows[0].actual, 0)
  assert.equal(r.rows[0].transactionMissing, true)
})

test('insights are derived from real data only', () => {
  const now = [plan({ name: 'Rent', amount: 120, category: 'home' }), plan({ name: 'Food', amount: 100, category: 'food', dueDate: '2026-11-01' })]
  const prev = [plan({ name: 'Rent', amount: 120, category: 'home' }), plan({ name: 'Food', amount: 60, category: 'food' })]
  const keys = plannerInsights(now, { incomes: [{ amount: 600 }], savings: [] }, prev, TODAY)
  const byKey = Object.fromEntries(keys.map((k) => [k.key, k.params]))
  assert.equal(byKey.planned_of_income.planned, 220)
  assert.equal(byKey.unallocated.amount, 380)
  assert.equal(byKey.largest.name, 'Rent')
  assert.equal(byKey.overdue.count, 1)
  assert.equal(byKey.more_than_last.amount, 40)
  assert.deepEqual(byKey.category_up, { category: 'food', amount: 40 })
  assert.deepEqual(plannerInsights([], null, [], TODAY), [], 'nothing to say without data')
})

test('sorting puts overdue first, then by due date', () => {
  const list = sortPlans([
    plan({ name: 'B', dueDate: '2026-11-20' }), plan({ name: 'Paid', dueDate: '2026-11-01', status: 'paid' }),
    plan({ name: 'Late', dueDate: '2026-11-02' }), plan({ name: 'A', dueDate: '2026-11-18' }),
  ], TODAY)
  assert.deepEqual(list.map((p) => p.name), ['Late', 'A', 'B', 'Paid'])
  assert.deepEqual(sortPlans([plan({ name: 's', amount: 1 }), plan({ name: 'b', amount: 9 })], TODAY, 'amount').map((p) => p.name), ['b', 's'])
})
