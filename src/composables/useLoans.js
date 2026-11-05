import { ref, computed } from 'vue'
import { auth } from '../firebase'
import { db } from '../firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy, writeBatch
} from 'firebase/firestore'

/**
 * "My Loans" — money the user owes to someone else (a lender, bank, or
 * family member). Deliberately a separate data model and calculation engine
 * from the Lending tracker (`useTransactions` borrow/payback records, which
 * track money owed TO the user).
 *
 * Loan doc:        { lenderName, originalAmount, currency, interestType, interestRate,
 *                     startDate, expectedMonthlyPayment, paymentFrequency,
 *                     customIntervalDays, firstPaymentDate, notes, archived, createdAt, updatedAt }
 * LoanPayment doc:  { loanId, amount, paymentDate, paymentMethod, note, createdAt, updatedAt }
 *
 * `status` (active / paid off) is deliberately NOT stored — it's always derived
 * from remainingBalance, so it can never drift out of sync with payment history.
 * `archived` is the one genuinely-manual flag (a user's explicit "hide this" action).
 */

// ── Module-level singletons ───────────────────────────────────────────────────
const loans = ref([])
const loanPayments = ref([])
const loading = ref(true)
let _unsubLoans = null
let _unsubPayments = null

// Data is only cleared on logout — not before the new listeners connect — to prevent blank screens.
// `loading` stays true until BOTH listeners have delivered their first snapshot (or failed).
onAuthStateChanged(auth, (user) => {
  if (_unsubLoans) { _unsubLoans(); _unsubLoans = null }
  if (_unsubPayments) { _unsubPayments(); _unsubPayments = null }

  if (user) {
    loading.value = true
    let loansReady = false
    let paymentsReady = false
    const markReady = () => { if (loansReady && paymentsReady) loading.value = false }

    const loansQ = query(collection(db, 'users', user.uid, 'loans'), orderBy('createdAt', 'desc'))
    _unsubLoans = onSnapshot(loansQ, { includeMetadataChanges: true }, (snap) => {
      // Empty on-device cache (first visit) ≠ "no data": wait for the server
      if (snap.metadata.fromCache && snap.empty && navigator.onLine) return
      if (loansReady && snap.docChanges().length === 0) return // metadata-only
      loans.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      loansReady = true
      markReady()
    }, (error) => {
      console.error('[loans] listener error:', error)
      loansReady = true
      markReady()
    })

    const paymentsQ = query(collection(db, 'users', user.uid, 'loanPayments'), orderBy('paymentDate', 'desc'))
    _unsubPayments = onSnapshot(paymentsQ, { includeMetadataChanges: true }, (snap) => {
      // Empty on-device cache (first visit) ≠ "no data": wait for the server
      if (snap.metadata.fromCache && snap.empty && navigator.onLine) return
      if (paymentsReady && snap.docChanges().length === 0) return // metadata-only
      loanPayments.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      paymentsReady = true
      markReady()
    }, (error) => {
      console.error('[loanPayments] listener error:', error)
      paymentsReady = true
      markReady()
    })
  } else {
    loans.value = []
    loanPayments.value = []
    loading.value = false
  }
})

// ── Local-date helpers (avoid UTC-parse surprises, same approach used in AnalyticsPage) ──
const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatLocalDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

// Advance one payment interval, frequency-aware. Monthly uses real calendar-month
// arithmetic (not a fixed 30 days) so payoff-date estimates land on real dates.
const addInterval = (date, loan) => {
  const next = new Date(date)
  switch (loan.paymentFrequency) {
    case 'weekly':   next.setDate(next.getDate() + 7); break
    case 'biweekly': next.setDate(next.getDate() + 14); break
    case 'custom':   next.setDate(next.getDate() + (Number(loan.customIntervalDays) || 30)); break
    default:         next.setMonth(next.getMonth() + 1) // monthly
  }
  return next
}

const round2 = (n) => Math.round(n * 100) / 100

export function useLoans() {
  // Throws instead of silently writing to `users/undefined/...` when signed out.
  const requireUid = () => {
    const id = auth.currentUser?.uid
    if (!id) throw new Error('Not authenticated')
    return id
  }

  // Log with a tag and re-throw so the calling page can show an error toast.
  const run = async (label, fn) => {
    try {
      return await fn()
    } catch (error) {
      console.error(`[loans] ${label} failed:`, error)
      throw error
    }
  }

  // ── CRUD: Loans ──────────────────────────────────────────────────────────────
  const addLoan = async (data) => {
    const id = requireUid()
    const now = new Date().toISOString()
    await run('addLoan', () =>
      addDoc(collection(db, 'users', id, 'loans'), { ...data, archived: false, createdAt: now, updatedAt: now }))
  }
  const updateLoan = async (loanId, updates) => {
    const id = requireUid()
    await run('updateLoan', () =>
      updateDoc(doc(db, 'users', id, 'loans', loanId), { ...updates, updatedAt: new Date().toISOString() }))
  }
  const deleteLoan = async (loanId) => {
    const id = requireUid()
    // Delete payments first, then the loan, in batched writes (max 500 ops each).
    // Payments-first order means a failure part-way leaves the loan visible so
    // the user can simply retry — never orphaned payments with no loan.
    const refs = [
      ...loanPayments.value
        .filter(p => p.loanId === loanId)
        .map(p => doc(db, 'users', id, 'loanPayments', p.id)),
      doc(db, 'users', id, 'loans', loanId),
    ]
    await run('deleteLoan', async () => {
      for (let i = 0; i < refs.length; i += 500) {
        const batch = writeBatch(db)
        refs.slice(i, i + 500).forEach(ref => batch.delete(ref))
        await batch.commit()
      }
    })
  }
  const archiveLoan = async (loanId, archived = true) => {
    const id = requireUid()
    await run('archiveLoan', () =>
      updateDoc(doc(db, 'users', id, 'loans', loanId), { archived, updatedAt: new Date().toISOString() }))
  }

  // ── CRUD: Payments ───────────────────────────────────────────────────────────
  const addPayment = async (loanId, data) => {
    const id = requireUid()
    const now = new Date().toISOString()
    await run('addPayment', () =>
      addDoc(collection(db, 'users', id, 'loanPayments'), { ...data, loanId, createdAt: now, updatedAt: now }))
  }
  const updatePayment = async (paymentId, updates) => {
    const id = requireUid()
    await run('updatePayment', () =>
      updateDoc(doc(db, 'users', id, 'loanPayments', paymentId), { ...updates, updatedAt: new Date().toISOString() }))
  }
  const deletePayment = async (paymentId) => {
    const id = requireUid()
    await run('deletePayment', () => deleteDoc(doc(db, 'users', id, 'loanPayments', paymentId)))
  }

  // ── Derived calculations — always computed fresh, never cached/stored ────────
  const getPaymentsForLoan = (loanId) =>
    loanPayments.value
      .filter(p => p.loanId === loanId)
      .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0))

  const getTotalPaid = (loanId) =>
    getPaymentsForLoan(loanId).reduce((s, p) => s + Number(p.amount), 0)

  const getRemainingBalance = (loan) =>
    Math.max(0, round2(Number(loan.originalAmount) - getTotalPaid(loan.id)))

  // Raw (unrounded) percentage — the UI decides how many decimals to show,
  // since a clean payment history can land on a whole number (40%) while an
  // uneven one won't (25.33%).
  const getProgressPct = (loan) => {
    const original = Number(loan.originalAmount)
    if (!original) return 0
    return Math.min(100, (getTotalPaid(loan.id) / original) * 100)
  }

  // Ceiling, never floor — flooring would tell the user the loan finishes
  // earlier than it actually will whenever the last payment is a partial one.
  const getRemainingPayments = (loan) => {
    const remaining = getRemainingBalance(loan)
    if (remaining <= 0) return 0
    const payment = Number(loan.expectedMonthlyPayment)
    if (!payment || payment <= 0) return null // no expected payment set — can't estimate
    return Math.ceil(remaining / payment)
  }

  const getFinalPaymentAmount = (loan) => {
    const remaining = getRemainingBalance(loan)
    if (remaining <= 0) return 0
    const count = getRemainingPayments(loan)
    if (count === null) return null
    if (count <= 1) return remaining
    return round2(remaining - (count - 1) * Number(loan.expectedMonthlyPayment))
  }

  const getNextPaymentDate = (loan) => {
    const payments = getPaymentsForLoan(loan.id)
    if (payments.length === 0) {
      let next = parseLocalDate(loan.firstPaymentDate || loan.startDate)
      const today = startOfToday()
      while (next < today) next = addInterval(next, loan)
      return next
    }
    return addInterval(parseLocalDate(payments[0].paymentDate), loan) // [0] = most recent (sorted desc)
  }

  const getEstimatedPayoffDate = (loan) => {
    const count = getRemainingPayments(loan)
    if (count === null) return null
    if (count === 0) {
      const payments = getPaymentsForLoan(loan.id)
      return payments.length ? parseLocalDate(payments[0].paymentDate) : null
    }
    let date = getNextPaymentDate(loan)
    for (let i = 1; i < count; i++) date = addInterval(date, loan)
    return date
  }

  // 'paid' | 'upcoming' | 'overdue' — never auto-marks a payment as made;
  // this only reflects whether one is due, not whether it happened.
  const getPaymentStatus = (loan) => {
    if (getRemainingBalance(loan) <= 0) return 'paid'
    return getNextPaymentDate(loan) < startOfToday() ? 'overdue' : 'upcoming'
  }

  const getRepaymentSchedule = (loan) => {
    const count = getRemainingPayments(loan)
    if (!count) return []
    const payment = Number(loan.expectedMonthlyPayment)
    const finalAmount = getFinalPaymentAmount(loan)
    let date = getNextPaymentDate(loan)
    let remaining = getRemainingBalance(loan)
    const rows = []
    for (let i = 0; i < count; i++) {
      const amount = i === count - 1 ? finalAmount : payment
      remaining = Math.max(0, round2(remaining - amount))
      rows.push({ date: formatLocalDate(date), payment: amount, remaining })
      date = addInterval(date, loan)
    }
    return rows
  }

  const isLoanPaidOff = (loan) => getRemainingBalance(loan) <= 0

  // ── Aggregate dashboard stats ──────────────────────────────────────────────
  const activeLoans = computed(() => loans.value.filter(l => !l.archived && !isLoanPaidOff(l)))
  const completedLoans = computed(() => loans.value.filter(l => !l.archived && isLoanPaidOff(l)))
  const archivedLoans = computed(() => loans.value.filter(l => l.archived))

  const totalOriginalDebt = computed(() => activeLoans.value.reduce((s, l) => s + Number(l.originalAmount), 0))
  const totalPaidAll = computed(() => activeLoans.value.reduce((s, l) => s + getTotalPaid(l.id), 0))
  const totalRemainingAll = computed(() => activeLoans.value.reduce((s, l) => s + getRemainingBalance(l), 0))
  const activeLoanCount = computed(() => activeLoans.value.length)
  const totalMonthlyPayments = computed(() => activeLoans.value.reduce((s, l) => s + Number(l.expectedMonthlyPayment || 0), 0))

  return {
    loans, loanPayments, loading,
    addLoan, updateLoan, deleteLoan, archiveLoan,
    addPayment, updatePayment, deletePayment,
    getPaymentsForLoan, getTotalPaid, getRemainingBalance, getProgressPct,
    getRemainingPayments, getFinalPaymentAmount, getNextPaymentDate,
    getEstimatedPayoffDate, getPaymentStatus, getRepaymentSchedule, isLoanPaidOff,
    activeLoans, completedLoans, archivedLoans,
    totalOriginalDebt, totalPaidAll, totalRemainingAll, activeLoanCount, totalMonthlyPayments,
  }
}
