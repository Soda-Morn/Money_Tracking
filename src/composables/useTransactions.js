import { ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy
} from 'firebase/firestore'

// ── Module-level singleton ────────────────────────────────────────────────────
const transactions = ref([])
const loading = ref(true)
let _unsubscribe = null

// Re-initialize the Firestore listener on every auth state change.
// This ensures data is cleared when a user logs out and reloaded for the new user.
onAuthStateChanged(auth, (user) => {
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }
  transactions.value = []

  if (user) {
    loading.value = true
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    )
    _unsubscribe = onSnapshot(q, (snapshot) => {
      transactions.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    })
  } else {
    loading.value = false
  }
})

// ── Composable ────────────────────────────────────────────────────────────────
export function useTransactions() {
  const uid = () => auth.currentUser?.uid

  const addTransaction = async (transaction) => {
    await addDoc(collection(db, 'users', uid(), 'transactions'), {
      ...transaction,
      createdAt: new Date().toISOString()
    })
  }

  const updateTransaction = async (id, updates) => {
    await updateDoc(doc(db, 'users', uid(), 'transactions', id), updates)
  }

  const deleteTransaction = async (id) => {
    await deleteDoc(doc(db, 'users', uid(), 'transactions', id))
  }

  const getTransactionsByDate = (date) =>
    transactions.value.filter(t => t.date === date)

  const getTransactionsByDateRange = (startDate, endDate) =>
    transactions.value.filter(t => t.date >= startDate && t.date <= endDate)

  const totalIncome = computed(() =>
    transactions.value
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  )

  const totalExpense = computed(() =>
    transactions.value
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  )

  const totalBalance = computed(() => totalIncome.value - totalExpense.value)

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
    return { income, expense, balance: income - expense }
  }

  const getMonthlyData = (year, month) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    return getTransactionsByDateRange(startDate, endDate)
  }

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionsByDate,
    getTransactionsByDateRange,
    totalIncome,
    totalExpense,
    totalBalance,
    transactionsByDate,
    getDailySummary,
    getMonthlyData
  }
}
