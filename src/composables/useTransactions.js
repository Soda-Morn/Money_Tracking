import { computed } from 'vue'
import { useStorage } from './useStorage'

/**
 * Composable for managing transactions (income/expense)
 * Provides CRUD operations and computed summaries
 */
export function useTransactions() {
  const transactions = useStorage('money-tracking-transactions', [])

  // Generate unique ID
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

  // Add new transaction
  const addTransaction = (transaction) => {
    transactions.value.unshift({
      id: generateId(),
      ...transaction,
      createdAt: new Date().toISOString()
    })
  }

  // Update existing transaction
  const updateTransaction = (id, updates) => {
    const index = transactions.value.findIndex(t => t.id === id)
    if (index !== -1) {
      transactions.value[index] = { ...transactions.value[index], ...updates }
    }
  }

  // Delete transaction
  const deleteTransaction = (id) => {
    const index = transactions.value.findIndex(t => t.id === id)
    if (index !== -1) {
      transactions.value.splice(index, 1)
    }
  }

  // Get transactions by date
  const getTransactionsByDate = (date) => {
    return transactions.value.filter(t => t.date === date)
  }

  // Get transactions by date range
  const getTransactionsByDateRange = (startDate, endDate) => {
    return transactions.value.filter(t => t.date >= startDate && t.date <= endDate)
  }

  // Total income
  const totalIncome = computed(() => {
    return transactions.value
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  })

  // Total expense
  const totalExpense = computed(() => {
    return transactions.value
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  })

  // Total balance
  const totalBalance = computed(() => totalIncome.value - totalExpense.value)

  // Group transactions by date
  const transactionsByDate = computed(() => {
    const grouped = {}
    transactions.value.forEach(t => {
      if (!grouped[t.date]) {
        grouped[t.date] = []
      }
      grouped[t.date].push(t)
    })
    return grouped
  })

  // Get daily summary for a specific date
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

  // Get monthly data for charts
  const getMonthlyData = (year, month) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    return getTransactionsByDateRange(startDate, endDate)
  }

  return {
    transactions,
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
