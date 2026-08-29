import { ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy
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

onAuthStateChanged(auth, (user) => {
  if (_unsubLoans) { _unsubLoans(); _unsubLoans = null }
  if (_unsubPayments) { _unsubPayments(); _unsubPayments = null }
  loans.value = []
  loanPayments.value = []

  if (user) {
    loading.value = true
    const loansQ = query(collection(db, 'users', user.uid, 'loans'), orderBy('createdAt', 'desc'))
    _unsubLoans = onSnapshot(loansQ, (snap) => {
      loans.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
    const paymentsQ = query(collection(db, 'users', user.uid, 'loanPayments'), orderBy('paymentDate', 'desc'))
    _unsubPayments = onSnapshot(paymentsQ, (snap) => {
      loanPayments.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    })
  } else {
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
  const uid = () => auth.currentUser?.uid

  // ── CRUD: Loans ──────────────────────────────────────────────────────────────
  const addLoan = async (data) => {
    const now = new Date().toISOString()
    await addDoc(collection(db, 'users', uid(), 'loans'), { ...data, archived: false, createdAt: now, updatedAt: now })
  }
  const updateLoan = async (id, updates) => {
    await updateDoc(doc(db, 'users', uid(), 'loans', id), { ...updates, updatedAt: new Date().toISOString() })
  }
  const deleteLoan = async (id) => {
    await deleteDoc(doc(db, 'users', uid(), 'loans', id))
    // Delete this loan's payments too so they don't orphan in the collection.
    const orphaned = loanPayments.value.filter(p => p.loanId === id)
    await Promise.all(orphaned.map(p => deleteDoc(doc(db, 'users', uid(), 'loanPayments', p.id))))
  }
  const archiveLoan = async (id, archived = true) => {
    await updateDoc(doc(db, 'users', uid(), 'loans', id), { archived, updatedAt: new Date().toISOString() })
  }

  // ── CRUD: Payments ───────────────────────────────────────────────────────────
  const addPayment = async (loanId, data) => {
    const now = new Date().toISOString()
    await addDoc(collection(db, 'users', uid(), 'loanPayments'), { ...data, loanId, createdAt: now, updatedAt: now })
  }
  const updatePayment = async (id, updates) => {
    await updateDoc(doc(db, 'users', uid(), 'loanPayments', id), { ...updates, updatedAt: new Date().toISOString() })
  }
  const deletePayment = async (id) => {
    await deleteDoc(doc(db, 'users', uid(), 'loanPayments', id))
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
