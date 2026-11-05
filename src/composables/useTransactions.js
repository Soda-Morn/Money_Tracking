import { ref, computed } from 'vue'
import { auth } from '../firebase'
import { db } from '../firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy
} from 'firebase/firestore'
import { sumByType } from '../shared/finance'

// ── Module-level singleton ────────────────────────────────────────────────────
const transactions = ref([])
const loading = ref(true)
// true while showing data from the on-device cache that the server hasn't confirmed yet
const syncing = ref(false)
let _unsubscribe = null

// Re-initialize the Firestore listener on every auth state change.
// Data is only cleared on logout — not before the new listener connects — to prevent blank screens.
onAuthStateChanged(auth, (user) => {
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }

  if (user) {
    loading.value = true
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    )
    // includeMetadataChanges: also notified when cached data is confirmed by
    // the server, so `syncing` can't get stuck while the docs themselves are unchanged.
    _unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      syncing.value = snapshot.metadata.fromCache
      // An EMPTY cache (first visit on this device) must not be shown as
      // "no transactions" — keep the skeleton until the server answers.
      if (snapshot.metadata.fromCache && snapshot.empty && navigator.onLine) return
      // Metadata-only update (cache → server confirmed, no data change): don't rebuild the list
      if (!loading.value && snapshot.docChanges().length === 0) return
      transactions.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    }, (error) => {
      console.error('[transactions] listener error:', error)
      loading.value = false
      syncing.value = false
    })
  } else {
    transactions.value = []
    loading.value = false
    syncing.value = false
  }
})

// ── Composable ────────────────────────────────────────────────────────────────
export function useTransactions() {
  const uid = () => auth.currentUser?.uid

  const addTransaction = async (transaction) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await addDoc(collection(db, 'users', currentUid, 'transactions'), {
        ...transaction,
        createdAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('[transactions] addTransaction failed:', error)
      throw error
    }
  }

  const updateTransaction = async (id, updates) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await updateDoc(doc(db, 'users', currentUid, 'transactions', id), updates)
    } catch (error) {
      console.error('[transactions] updateTransaction failed:', error)
      throw error
    }
  }

  const deleteTransaction = async (id) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'transactions', id))
    } catch (error) {
      console.error('[transactions] deleteTransaction failed:', error)
      throw error
    }
  }

  const getTransactionsByDate = (date) =>
    transactions.value.filter(t => t.date === date)

  const getTransactionsByDateRange = (startDate, endDate) =>
    transactions.value.filter(t => t.date >= startDate && t.date <= endDate)

  // Totals use the shared rules (src/shared/finance.js) — same numbers as the Telegram bot
  const totalIncome = computed(() => sumByType(transactions.value, 'income'))

  const totalExpense = computed(() => sumByType(transactions.value, 'expense'))

  const totalBorrow = computed(() => sumByType(transactions.value, 'borrow'))

  const totalPayback = computed(() => sumByType(transactions.value, 'payback'))

  const totalBalance = computed(() => totalIncome.value - totalExpense.value + totalBorrow.value - totalPayback.value)

  const transactionsByDate = computed(() => {
    const grouped = {}
    transactions.value.forEach(t => {
      if (!grouped[t.date]) grouped[t.date] = []
      grouped[t.date].push(t)
    })
    return grouped
  })

  const getDailySummary = (date) => {
    const dayTransactions = getTransactionsByDate(date)
    const income = dayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expense = dayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const borrow = dayTransactions
      .filter(t => t.type === 'borrow')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const payback = dayTransactions
      .filter(t => t.type === 'payback')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    return { income, expense, borrow, payback, balance: income - expense + borrow - payback }
  }

  const getMonthlyData = (year, month) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    return getTransactionsByDateRange(startDate, endDate)
  }

  return {
    transactions,
    loading,
    syncing,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionsByDate,
    getTransactionsByDateRange,
    totalIncome,
    totalExpense,
    totalBorrow,
    totalPayback,
    totalBalance,
    transactionsByDate,
    getDailySummary,
    getMonthlyData
  }
}
