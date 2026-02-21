<script setup>
import { computed, ref } from 'vue'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import ExpenseChart from '../components/charts/ExpenseChart.vue'
import TrendChart from '../components/charts/TrendChart.vue'
import BarChart from '../components/charts/BarChart.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const { transactions, totalIncome, totalExpense, totalBalance } = useTransactions()
const { formatCurrency, getMonthName } = useFormat()

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// Filter transactions for current month
const monthlyTransactions = computed(() => {
  return transactions.value.filter(t => {
    const date = new Date(t.date)
    return date.getMonth() === currentMonth.value && date.getFullYear() === currentYear.value
  })
})

// Expense transactions only
const expenseTransactions = computed(() => {
  return transactions.value.filter(t => t.type === 'expense')
})

// Income transactions only
const incomeTransactions = computed(() => {
  return transactions.value.filter(t => t.type === 'income')
})

// Monthly totals
const monthlyIncome = computed(() => {
  return monthlyTransactions.value
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
})

const monthlyExpense = computed(() => {
  return monthlyTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)
})

// Top spending categories
const topCategories = computed(() => {
  const grouped = {}
  expenseTransactions.value.forEach(t => {
    if (!grouped[t.category]) {
      grouped[t.category] = 0
    }
    grouped[t.category] += Number(t.amount)
  })

  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))
})

const categoryLabels = {
  food: 'Food & Dining',
  transport: 'Transportation',
  shopping: 'Shopping',
  bills: 'Bills & Utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  education: 'Education',
  other: 'Other'
}

// Navigate months
const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Analytics</h1>
      <p class="text-gray-500 mt-1">Visualize your financial data</p>
    </div>

    <!-- Empty State -->
    <BaseCard v-if="transactions.length === 0">
      <EmptyState
        title="No data to analyze"
        description="Add some transactions to see your financial analytics"
        icon="chart"
      />
    </BaseCard>

    <template v-else>
      <!-- Month Selector -->
      <BaseCard>
        <div class="flex items-center justify-between">
          <button
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            @click="prevMonth"
          >
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-lg font-semibold text-gray-900">
            {{ getMonthName(currentMonth) }} {{ currentYear }}
          </h2>
          <button
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            @click="nextMonth"
          >
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Monthly Summary -->
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-green-50 rounded-lg p-4">
            <p class="text-sm text-green-600 mb-1">Monthly Income</p>
            <p class="text-xl font-bold text-green-700">{{ formatCurrency(monthlyIncome) }}</p>
          </div>
          <div class="bg-red-50 rounded-lg p-4">
            <p class="text-sm text-red-600 mb-1">Monthly Expense</p>
            <p class="text-xl font-bold text-red-700">{{ formatCurrency(monthlyExpense) }}</p>
          </div>
        </div>
      </BaseCard>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Expense Breakdown -->
        <BaseCard>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Expense by Category</h3>
          <ExpenseChart
            v-if="expenseTransactions.length > 0"
            :data="expenseTransactions"
            type="doughnut"
          />
          <div v-else class="h-64 flex items-center justify-center text-gray-500">
            No expense data
          </div>
        </BaseCard>

        <!-- Income Breakdown -->
        <BaseCard>
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Income by Category</h3>
          <ExpenseChart
            v-if="incomeTransactions.length > 0"
            :data="incomeTransactions"
            type="doughnut"
          />
          <div v-else class="h-64 flex items-center justify-center text-gray-500">
            No income data
          </div>
        </BaseCard>
      </div>

      <!-- Trend Chart -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Daily Trend (Last 14 Days)</h3>
        <TrendChart :data="transactions" />
      </BaseCard>

      <!-- Monthly Comparison -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Monthly Comparison</h3>
        <BarChart :data="transactions" />
      </BaseCard>

      <!-- Top Spending Categories -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Spending Categories</h3>
        <div class="space-y-3">
          <div
            v-for="(item, index) in topCategories"
            :key="item.category"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <span class="w-6 h-6 flex items-center justify-center text-sm font-medium bg-gray-100 rounded-full text-gray-600">
                {{ index + 1 }}
              </span>
              <span class="text-gray-900">{{ categoryLabels[item.category] || item.category }}</span>
            </div>
            <span class="font-medium text-gray-900">{{ formatCurrency(item.amount) }}</span>
          </div>
          <p v-if="topCategories.length === 0" class="text-gray-500 text-center py-4">
            No expense data available
          </p>
        </div>
      </BaseCard>

      <!-- Overall Summary -->
      <BaseCard class="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <h3 class="text-lg font-semibold mb-4">All Time Summary</h3>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-blue-200 text-sm mb-1">Total Income</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalIncome) }}</p>
          </div>
          <div>
            <p class="text-blue-200 text-sm mb-1">Total Expense</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalExpense) }}</p>
          </div>
          <div>
            <p class="text-blue-200 text-sm mb-1">Net Balance</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalBalance) }}</p>
          </div>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
