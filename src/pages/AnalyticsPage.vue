<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import ExpenseChart from '../components/charts/ExpenseChart.vue'
import TrendChart from '../components/charts/TrendChart.vue'
import BarChart from '../components/charts/BarChart.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const { transactions, totalIncome, totalExpense, totalBalance } = useTransactions()
const { t } = useI18n()
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

// ── Spending Insights ─────────────────────────────────────────────────────────
const prevMonthTransactions = computed(() => {
  const pm = currentMonth.value === 0 ? 11 : currentMonth.value - 1
  const py = currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value
  return transactions.value.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === pm && d.getFullYear() === py
  })
})

const prevMonthExpense = computed(() =>
  prevMonthTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)
)

const topMonthlyCategory = computed(() => {
  const grouped = {}
  monthlyTransactions.value.filter(t => t.type === 'expense').forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + Number(t.amount)
  })
  const sorted = Object.entries(grouped).sort(([, a], [, b]) => b - a)
  if (!sorted.length) return null
  const [category, amount] = sorted[0]
  return { category, amount, label: categoryLabels[category] || category }
})

const expenseChange = computed(() => {
  if (!prevMonthExpense.value) return null
  const change = ((monthlyExpense.value - prevMonthExpense.value) / prevMonthExpense.value) * 100
  return Math.round(change)
})

const savingsRate = computed(() => {
  if (!monthlyIncome.value) return null
  return Math.round(((monthlyIncome.value - monthlyExpense.value) / monthlyIncome.value) * 100)
})

const avgDailySpend = computed(() => {
  const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getMonth() === currentMonth.value && today.getFullYear() === currentYear.value
  const days = isCurrentMonth ? today.getDate() : daysInMonth
  return days > 0 ? monthlyExpense.value / days : 0
})

const insights = computed(() => {
  const list = []
  if (topMonthlyCategory.value) {
    list.push({
      icon: '🏆',
      label: t('insight_top_category'),
      value: topMonthlyCategory.value.label,
      sub: formatCurrency(topMonthlyCategory.value.amount),
      color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    })
  }
  if (expenseChange.value !== null) {
    const up = expenseChange.value > 0
    list.push({
      icon: up ? '📈' : '📉',
      label: t('insight_vs_last_month'),
      value: (up ? '+' : '') + expenseChange.value + '%',
      sub: t('insight_spending'),
      color: up
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    })
  }
  if (savingsRate.value !== null) {
    list.push({
      icon: '💰',
      label: t('insight_savings_rate'),
      value: savingsRate.value + '%',
      sub: t('insight_of_income'),
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    })
  }
  list.push({
    icon: '📅',
    label: t('insight_avg_daily'),
    value: formatCurrency(avgDailySpend.value),
    sub: t('insight_per_day'),
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  })
  list.push({
    icon: '🔢',
    label: t('insight_transactions'),
    value: String(monthlyTransactions.value.length),
    sub: t('insight_this_month'),
    color: 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600'
  })
  return list
})

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
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('analytics') }}</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">{{ t('visualize_data') }}</p>
    </div>

    <!-- Empty State -->
    <BaseCard v-if="transactions.length === 0">
      <EmptyState
        :title="t('no_data_analytics_title')"
        :description="t('no_data_analytics_desc')"
        icon="chart"
      />
    </BaseCard>

    <template v-else>
      <!-- Month Selector -->
      <BaseCard>
        <div class="flex items-center justify-between">
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="prevMonth"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ getMonthName(currentMonth) }} {{ currentYear }}
          </h2>
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="nextMonth"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Monthly Summary -->
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p class="text-sm text-green-600 dark:text-green-400 mb-1">{{ t('monthly_income') }}</p>
            <p class="text-xl font-bold text-green-700 dark:text-green-400">{{ formatCurrency(monthlyIncome) }}</p>
          </div>
          <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p class="text-sm text-red-600 dark:text-red-400 mb-1">{{ t('monthly_expense') }}</p>
            <p class="text-xl font-bold text-red-700 dark:text-red-400">{{ formatCurrency(monthlyExpense) }}</p>
          </div>
        </div>
      </BaseCard>

      <!-- ── Spending Insights ──────────────────────────────────────────────── -->
      <div>
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-0.5">
          {{ t('spending_insights') }}
        </h3>
        <!-- Horizontal scroll on mobile, grid on desktop -->
        <div class="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible no-scrollbar">
          <div
            v-for="insight in insights"
            :key="insight.label"
            :class="['flex-shrink-0 w-36 sm:w-auto rounded-2xl border p-3.5', insight.color]"
          >
            <div class="text-2xl mb-2">{{ insight.icon }}</div>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">{{ insight.label }}</p>
            <p class="text-lg font-bold text-gray-900 dark:text-white mt-0.5 leading-tight truncate">{{ insight.value }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ insight.sub }}</p>
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Expense Breakdown -->
        <BaseCard>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('expense_by_category') }}</h3>
          <ExpenseChart
            v-if="expenseTransactions.length > 0"
            :data="expenseTransactions"
            type="doughnut"
          />
          <div v-else class="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {{ t('no_expense_data') }}
          </div>
        </BaseCard>

        <!-- Income Breakdown -->
        <BaseCard>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('income_by_category') }}</h3>
          <ExpenseChart
            v-if="incomeTransactions.length > 0"
            :data="incomeTransactions"
            type="doughnut"
          />
          <div v-else class="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {{ t('no_income_data') }}
          </div>
        </BaseCard>
      </div>

      <!-- Trend Chart -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('daily_trend') }}</h3>
        <TrendChart :data="transactions" />
      </BaseCard>

      <!-- Monthly Comparison -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('monthly_comparison') }}</h3>
        <BarChart :data="transactions" />
      </BaseCard>

      <!-- Top Spending Categories -->
      <BaseCard>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('top_spending_categories') }}</h3>
        <div class="space-y-3">
          <div
            v-for="(item, index) in topCategories"
            :key="item.category"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <span class="w-6 h-6 flex items-center justify-center text-sm font-medium bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                {{ index + 1 }}
              </span>
              <span class="text-gray-900 dark:text-white">{{ categoryLabels[item.category] || item.category }}</span>
            </div>
            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(item.amount) }}</span>
          </div>
          <p v-if="topCategories.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-4">
            {{ t('no_expense_data') }}
          </p>
        </div>
      </BaseCard>

      <!-- Overall Summary -->
      <BaseCard class="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <h3 class="text-lg font-semibold mb-4">{{ t('all_transactions') }}</h3>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-blue-200 text-sm mb-1">{{ t('total_income') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalIncome) }}</p>
          </div>
          <div>
            <p class="text-blue-200 text-sm mb-1">{{ t('total_expense') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalExpense) }}</p>
          </div>
          <div>
            <p class="text-blue-200 text-sm mb-1">{{ t('total_balance') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalBalance) }}</p>
          </div>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
