<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import { useCategories } from '../composables/useCategories'
import { useBudget } from '../composables/useBudget'
import ExpenseChart from '../components/charts/ExpenseChart.vue'
import TrendChart from '../components/charts/TrendChart.vue'
import BarChart from '../components/charts/BarChart.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const { transactions, totalIncome, totalExpense, totalBalance } = useTransactions()
const { t } = useI18n()
const { formatCurrency, getMonthName, formatRelativeDate } = useFormat()
const { getCategoryInfo } = useCategories()
const { budgets } = useBudget()

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// ── Month / Quarter / Year period selector ────────────────────────────────────
const PERIODS = ['month', 'quarter', 'year']
const periodMode = ref('month')

const periodLabel = computed(() => {
  if (periodMode.value === 'year') return String(currentYear.value)
  if (periodMode.value === 'quarter') {
    const q = Math.floor(currentMonth.value / 3) + 1
    return `Q${q} ${currentYear.value}`
  }
  return `${getMonthName(currentMonth.value)} ${currentYear.value}`
})

const periodRange = computed(() => {
  if (periodMode.value === 'year') {
    return { start: new Date(currentYear.value, 0, 1), end: new Date(currentYear.value, 11, 31, 23, 59, 59) }
  }
  if (periodMode.value === 'quarter') {
    const q = Math.floor(currentMonth.value / 3)
    return { start: new Date(currentYear.value, q * 3, 1), end: new Date(currentYear.value, q * 3 + 3, 0, 23, 59, 59) }
  }
  return { start: new Date(currentYear.value, currentMonth.value, 1), end: new Date(currentYear.value, currentMonth.value + 1, 0, 23, 59, 59) }
})

const prevPeriodRange = computed(() => {
  const shift = periodMode.value === 'year' ? 12 : periodMode.value === 'quarter' ? 3 : 1
  let m = currentMonth.value - shift
  let y = currentYear.value
  while (m < 0) { m += 12; y-- }
  if (periodMode.value === 'year') return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) }
  if (periodMode.value === 'quarter') {
    const q = Math.floor(m / 3)
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0, 23, 59, 59) }
  }
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59) }
})

const inRange = (dateStr, range) => {
  const d = new Date(dateStr)
  return d >= range.start && d <= range.end
}

// Filter transactions for the selected period
const periodTransactions = computed(() => transactions.value.filter(t => inRange(t.date, periodRange.value)))
const prevPeriodTransactions = computed(() => transactions.value.filter(t => inRange(t.date, prevPeriodRange.value)))

// Expense / Income transactions (all-time — feed the two doughnut charts)
const expenseTransactions = computed(() => transactions.value.filter(t => t.type === 'expense'))
const incomeTransactions = computed(() => transactions.value.filter(t => t.type === 'income'))

// Period totals
const periodIncome = computed(() => periodTransactions.value.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0))
const periodExpense = computed(() => periodTransactions.value.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0))
const prevPeriodExpense = computed(() => prevPeriodTransactions.value.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0))

// Top spending categories (all-time)
const topCategories = computed(() => {
  const grouped = {}
  expenseTransactions.value.forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + Number(t.amount)
  })
  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))
})

const getCatLabel = (value) => getCategoryInfo(value, 'expense').label
const getCatIcon  = (value) => getCategoryInfo(value, 'expense').icon

// Current calendar month's budget — used for the "% of budget" rows on Top Categories
// (budgets are only ever set per-calendar-month, regardless of the Analysis period toggle)
const currentCalendarMonthKey = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})
const currentMonthCategoryLimits = computed(() => budgets.value[currentCalendarMonthKey.value]?.categories ?? {})

const topCategoriesWithBudget = computed(() =>
  topCategories.value.map(item => {
    const limit = currentMonthCategoryLimits.value[item.category]
    if (!limit) return { ...item, pct: null }
    return { ...item, limit, pct: Math.min(100, Math.round((item.amount / limit) * 100)) }
  })
)

// ── Stat cards: Savings Rate / Avg Daily Spend / MoM Change ───────────────────
const savingsRate = computed(() => {
  if (!periodIncome.value) return null
  return Math.round(((periodIncome.value - periodExpense.value) / periodIncome.value) * 100)
})

const avgDailySpend = computed(() => {
  const { start, end } = periodRange.value
  const today = new Date()
  const effectiveEnd = end > today ? today : end
  const days = Math.max(1, Math.round((effectiveEnd - start) / 86400000) + 1)
  return periodExpense.value / days
})

const expenseChange = computed(() => {
  if (!prevPeriodExpense.value) return null
  return Math.round(((periodExpense.value - prevPeriodExpense.value) / prevPeriodExpense.value) * 100)
})

const periodComparisonLabel = computed(() => ({
  month: t('insight_vs_last_month'),
  quarter: t('insight_vs_last_quarter'),
  year: t('insight_vs_last_year'),
}[periodMode.value]))

// ── Recent Daily Spend — last 3 distinct days with any activity ──────────────
const recentDailyGroups = computed(() => {
  const byDate = {}
  transactions.value.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  })
  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1)).slice(0, 3)
  return dates.map(date => {
    const rows = byDate[date]
    const net = rows.reduce((s, t) => s + (t.type === 'income' || t.type === 'borrow' ? Number(t.amount) : -Number(t.amount)), 0)
    return { date, label: formatRelativeDate(date), rows, net }
  })
})

const rowLabel = (t) => t.name || t.description || getCategoryInfo(t.category, t.type).label

// Navigate periods
const prevPeriod = () => {
  const shift = periodMode.value === 'year' ? 12 : periodMode.value === 'quarter' ? 3 : 1
  let m = currentMonth.value - shift
  let y = currentYear.value
  while (m < 0) { m += 12; y-- }
  currentMonth.value = m
  currentYear.value = y
}

const nextPeriod = () => {
  const shift = periodMode.value === 'year' ? 12 : periodMode.value === 'quarter' ? 3 : 1
  let m = currentMonth.value + shift
  let y = currentYear.value
  while (m > 11) { m -= 12; y++ }
  currentMonth.value = m
  currentYear.value = y
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
      <!-- Period Selector -->
      <BaseCard>
        <!-- Month / Quarter / Year toggle -->
        <div class="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-3">
          <button
            v-for="p in PERIODS"
            :key="p"
            :class="[
              'py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
              periodMode === p
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            ]"
            @click="periodMode = p"
          >{{ t('period_' + p) }}</button>
        </div>

        <div class="flex items-center justify-between">
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="prevPeriod"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ periodLabel }}
          </h2>
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="nextPeriod"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Period Summary -->
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p class="text-sm text-green-600 dark:text-green-400 mb-1">{{ t('monthly_income') }}</p>
            <p class="text-xl font-bold text-green-700 dark:text-green-400">{{ formatCurrency(periodIncome) }}</p>
          </div>
          <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p class="text-sm text-red-600 dark:text-red-400 mb-1">{{ t('monthly_expense') }}</p>
            <p class="text-xl font-bold text-red-700 dark:text-red-400">{{ formatCurrency(periodExpense) }}</p>
          </div>
        </div>
      </BaseCard>

      <!-- ── Key Stats ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="rounded-2xl border p-4 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <p class="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide mb-1">{{ t('insight_savings_rate') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ savingsRate === null ? '—' : savingsRate + '%' }}</p>
        </div>
        <div class="rounded-2xl border p-4 bg-tertiary-50 dark:bg-tertiary-900/20 border-tertiary-200 dark:border-tertiary-800">
          <p class="text-xs font-semibold text-tertiary-700 dark:text-tertiary-400 uppercase tracking-wide mb-1">{{ t('insight_avg_daily') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(avgDailySpend) }}</p>
        </div>
        <div :class="[
          'rounded-2xl border p-4',
          expenseChange === null ? 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600'
            : expenseChange > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        ]">
          <p class="text-xs font-semibold uppercase tracking-wide mb-1" :class="expenseChange === null ? 'text-gray-500 dark:text-gray-400' : expenseChange > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
            {{ periodComparisonLabel }}
          </p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            {{ expenseChange === null ? '—' : (expenseChange > 0 ? '+' : '') + expenseChange + '%' }}
            <span v-if="expenseChange !== null" class="text-base">{{ expenseChange > 0 ? '📈' : '📉' }}</span>
          </p>
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
            v-for="(item, index) in topCategoriesWithBudget"
            :key="item.category"
            class="space-y-1.5"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <span class="w-6 h-6 flex items-center justify-center text-sm font-medium bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                  {{ index + 1 }}
                </span>
                <span class="text-xl">{{ getCatIcon(item.category) }}</span>
                <span class="text-gray-900 dark:text-white">{{ getCatLabel(item.category) }}</span>
              </div>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ formatCurrency(item.amount) }}
                <span v-if="item.pct !== null" class="text-xs font-bold ml-1" :class="item.pct >= 100 ? 'text-red-500' : item.pct >= 80 ? 'text-amber-500' : 'text-green-600'">
                  {{ item.pct }}%
                </span>
              </span>
            </div>
            <div v-if="item.pct !== null" class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden ml-9">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="item.pct >= 100 ? 'bg-red-500' : item.pct >= 80 ? 'bg-amber-400' : 'bg-primary-500'"
                :style="{ width: item.pct + '%' }"
              />
              <p class="text-[10px] text-gray-400 mt-0.5">{{ t('of_budget') }}</p>
            </div>
          </div>
          <p v-if="topCategoriesWithBudget.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-4">
            {{ t('no_expense_data') }}
          </p>
        </div>
      </BaseCard>

      <!-- Recent Daily Spend -->
      <BaseCard v-if="recentDailyGroups.length > 0">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('recent_daily_spend') }}</h3>
        <div class="space-y-4">
          <div v-for="group in recentDailyGroups" :key="group.date">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ group.label }}</span>
              <span class="text-xs font-bold" :class="group.net >= 0 ? 'text-green-600' : 'text-red-500'">
                {{ group.net >= 0 ? '+' : '' }}{{ formatCurrency(group.net) }}
              </span>
            </div>
            <div class="space-y-1.5">
              <div v-for="tx in group.rows" :key="tx.id" class="flex items-center justify-between text-sm">
                <span class="text-gray-700 dark:text-gray-300 truncate">{{ rowLabel(tx) }}</span>
                <span
                  class="font-medium shrink-0 ml-2"
                  :class="(tx.type === 'income' || tx.type === 'borrow') ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'"
                >{{ (tx.type === 'income' || tx.type === 'borrow') ? '+' : '-' }}{{ formatCurrency(tx.amount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Overall Summary -->
      <BaseCard class="bg-gradient-to-r from-primary-700 to-primary-800 text-white">
        <h3 class="text-lg font-semibold mb-4">{{ t('all_transactions') }}</h3>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-primary-200 text-sm mb-1">{{ t('total_income') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalIncome) }}</p>
          </div>
          <div>
            <p class="text-primary-200 text-sm mb-1">{{ t('total_expense') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalExpense) }}</p>
          </div>
          <div>
            <p class="text-primary-200 text-sm mb-1">{{ t('total_balance') }}</p>
            <p class="text-xl font-bold">{{ formatCurrency(totalBalance) }}</p>
          </div>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
