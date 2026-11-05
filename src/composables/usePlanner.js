import { ref } from 'vue'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, runTransaction, deleteField,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { db } from '../firestore'
import { occurrencesInMonth, occurrenceId, shiftDateToMonth, addMonths } from '../shared/planner'
import { toLocalDateString } from './useFormat'

/**
 * Expense Planner data (all under users/{uid}/ — owner-only by the existing rules):
 *   plannedExpenses/{id}   one planned expense (status: pending | paid | cancelled)
 *   plannedSeries/{id}     a recurring rule; occurrences get id `${seriesId}_${dueDate}`
 *   plannerMonths/{YYYY-MM} { incomes:[{id,label,amount}], savings:[{id,goalId,label,amount}] }
 *
 * Planned items NEVER touch users/{uid}/transactions — so they can't affect
 * balances or reports. Only markPaid() creates a real expense, atomically.
 */

const plans = ref([])
const series = ref([])
const months = ref({}) // { 'YYYY-MM': { incomes, savings } }
const loading = ref(true)
let unsubs = []

const listen = (uid, name, onDocs, markReady) =>
  onSnapshot(collection(db, 'users', uid, name), { includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.fromCache && snap.empty && navigator.onLine) return // empty cache ≠ no data
    onDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    markReady?.()
  }, (error) => {
    console.error(`[planner] ${name} listener error:`, error)
    markReady?.()
  })

onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u())
  unsubs = []
  if (!user) {
    plans.value = []; series.value = []; months.value = {}; loading.value = false
    return
  }
  loading.value = true
  unsubs = [
    listen(user.uid, 'plannedExpenses', (docs) => { plans.value = docs }, () => { loading.value = false }),
    listen(user.uid, 'plannedSeries', (docs) => { series.value = docs }),
    listen(user.uid, 'plannerMonths', (docs) => { months.value = Object.fromEntries(docs.map((d) => [d.id, d])) }),
  ]
})

const requireUid = () => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  return uid
}
const now = () => new Date().toISOString()
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Error codes the UI turns into friendly messages. */
export class PlannerError extends Error {
  constructor(code) { super(code); this.code = code }
}

export function usePlanner() {
  // ── Create / edit ───────────────────────────────────────────────────────────
  /** A one-off plan, or a recurring series (+ its occurrence in that month). */
  async function addPlan({ name, amount, category, dueDate, description = '', frequency = 'none' }) {
    const uid = requireUid()
    const base = { name: name.trim(), amount: Number(amount), category, description: description.trim() }
    if (frequency && frequency !== 'none') {
      const ref = await addDoc(collection(db, 'users', uid, 'plannedSeries'), {
        ...base, frequency, anchorDate: dueDate, active: true, createdAt: now(),
      })
      await ensureOccurrences(dueDate.slice(0, 7), [{ id: ref.id, ...base, frequency, anchorDate: dueDate, active: true }])
      return ref.id
    }
    const ref = await addDoc(collection(db, 'users', uid, 'plannedExpenses'), {
      ...base, month: dueDate.slice(0, 7), dueDate, status: 'pending', createdAt: now(), updatedAt: now(),
    })
    return ref.id
  }

  /** Edit a pending plan (only that occurrence, for recurring ones). */
  async function updatePlan(id, { name, amount, category, dueDate, description }) {
    const uid = requireUid()
    await updateDoc(doc(db, 'users', uid, 'plannedExpenses', id), clean({
      name: name?.trim(), amount: amount != null ? Number(amount) : undefined, category,
      dueDate, month: dueDate ? dueDate.slice(0, 7) : undefined, description: description?.trim(), updatedAt: now(),
    }))
  }

  // ── Status changes ──────────────────────────────────────────────────────────
  const setStatus = (id, fields) => updateDoc(doc(db, 'users', requireUid(), 'plannedExpenses', id), { ...fields, updatedAt: now() })
  const cancelPlan = (id) => setStatus(id, { status: 'cancelled', cancelledAt: now() })
  const restorePlan = (id) => setStatus(id, { status: 'pending', cancelledAt: deleteField() })

  /** Permanently remove a one-off plan that was never paid (recurring ones are cancelled instead). */
  async function deletePlan(plan) {
    if (plan.status === 'paid') throw new PlannerError('paid_cannot_delete')
    if (plan.seriesId) throw new PlannerError('recurring_cancel_instead')
    await deleteDoc(doc(db, 'users', requireUid(), 'plannedExpenses', plan.id))
  }

  /**
   * Confirm a payment: atomically create the REAL expense transaction and mark
   * the plan paid. The transaction id `plan_<planId>` + the status check make
   * double payment impossible (double-tap, two tabs, retries).
   */
  async function markPaid(id, { actualAmount, paidDate }) {
    const uid = requireUid()
    const planRef = doc(db, 'users', uid, 'plannedExpenses', id)
    const txRef = doc(db, 'users', uid, 'transactions', `plan_${id}`)
    await runTransaction(db, async (t) => {
      const [p, existing] = await Promise.all([t.get(planRef), t.get(txRef)])
      if (!p.exists()) throw new PlannerError('not_found')
      if (p.data().status !== 'pending') throw new PlannerError('not_pending')
      if (existing.exists()) throw new PlannerError('already_paid')
      const plan = p.data()
      // Exactly the app's transaction shape (+ a link back to the plan)
      t.set(txRef, {
        type: 'expense',
        amount: Number(actualAmount),
        category: plan.category,
        description: plan.description ? `${plan.name} · ${plan.description}` : plan.name,
        date: paidDate,
        createdAt: now(),
        source: 'planner',
        plannedExpenseId: id,
      })
      t.update(planRef, { status: 'paid', actualAmount: Number(actualAmount), paidAt: paidDate, transactionId: txRef.id, updatedAt: now() })
    })
  }

  /** Undo a payment: remove the real expense it created and make the plan pending again (atomic). */
  async function undoPayment(id) {
    const uid = requireUid()
    const planRef = doc(db, 'users', uid, 'plannedExpenses', id)
    await runTransaction(db, async (t) => {
      const p = await t.get(planRef)
      if (!p.exists() || p.data().status !== 'paid') throw new PlannerError('not_paid')
      const txId = p.data().transactionId
      if (txId) t.delete(doc(db, 'users', uid, 'transactions', txId))
      t.update(planRef, {
        status: 'pending', actualAmount: deleteField(), paidAt: deleteField(), transactionId: deleteField(), updatedAt: now(),
      })
    })
  }

  // ── Expected income & planned savings (per month) ──────────────────────────
  async function saveMonth(month, { incomes, savings }) {
    await setDoc(doc(db, 'users', requireUid(), 'plannerMonths', month), clean({
      incomes: incomes?.map((i) => ({ id: i.id, label: String(i.label || '').trim(), amount: Number(i.amount) })),
      savings: savings?.map((s) => clean({ id: s.id, goalId: s.goalId || undefined, label: String(s.label || '').trim(), amount: Number(s.amount) })),
      updatedAt: now(),
    }), { merge: true })
  }

  // ── Recurring ───────────────────────────────────────────────────────────────
  /**
   * Make sure every active series has its occurrences in `month`.
   * Create-only inside a transaction with deterministic ids → never duplicated,
   * even with two tabs open. Never creates real transactions.
   */
  async function ensureOccurrences(month, only) {
    const uid = auth.currentUser?.uid
    if (!uid) return 0
    // Don't generate far into the future
    const thisMonth = toLocalDateString(new Date()).slice(0, 7)
    if (month > addMonths(thisMonth, 24)) return 0
    const existing = new Set(plans.value.map((p) => p.id))
    let created = 0
    for (const s of (only || series.value)) {
      if (!s.active) continue
      for (const dueDate of occurrencesInMonth(s, month)) {
        const id = occurrenceId(s.id, dueDate)
        if (existing.has(id)) continue
        const ref = doc(db, 'users', uid, 'plannedExpenses', id)
        const didCreate = await runTransaction(db, async (t) => {
          if ((await t.get(ref)).exists()) return false
          t.set(ref, {
            name: s.name, amount: Number(s.amount), category: s.category, description: s.description || '',
            month, dueDate, status: 'pending', seriesId: s.id, frequency: s.frequency, createdAt: now(), updatedAt: now(),
          })
          return true
        }).catch((e) => { console.error('[planner] occurrence failed:', e); return false })
        if (didCreate) created++
      }
    }
    return created
  }

  /** Stop a recurring expense: no new occurrences; future pending ones are cancelled. */
  async function stopSeries(seriesId, today) {
    const uid = requireUid()
    await updateDoc(doc(db, 'users', uid, 'plannedSeries', seriesId), { active: false, endMonth: today.slice(0, 7), stoppedAt: now() })
    const future = plans.value.filter((p) => p.seriesId === seriesId && p.status === 'pending' && p.dueDate > today)
    await Promise.all(future.map((p) => cancelPlan(p.id)))
    return future.length
  }

  // ── Copy a month ────────────────────────────────────────────────────────────
  /**
   * Copy selected one-off plans into `toMonth` as new pending plans with
   * re-dated due dates. Deterministic ids (`copy_<source>_<month>`) make
   * copying twice harmless. Payments/transactions are never copied.
   */
  async function copyPlans(sourcePlans, toMonth) {
    const uid = requireUid()
    let created = 0
    for (const src of sourcePlans) {
      if (src.seriesId) continue // recurring ones generate themselves
      const ref = doc(db, 'users', uid, 'plannedExpenses', `copy_${src.id}_${toMonth}`)
      const ok = await runTransaction(db, async (t) => {
        if ((await t.get(ref)).exists()) return false
        t.set(ref, {
          name: src.name, amount: Number(src.amount), category: src.category, description: src.description || '',
          month: toMonth, dueDate: shiftDateToMonth(src.dueDate, toMonth), status: 'pending',
          copiedFrom: src.id, createdAt: now(), updatedAt: now(),
        })
        return true
      })
      if (ok) created++
    }
    return created
  }

  return {
    plans, series, months, loading,
    addPlan, updatePlan, cancelPlan, restorePlan, deletePlan, markPaid, undoPayment,
    saveMonth, ensureOccurrences, stopSeries, copyPlans,
  }
}
