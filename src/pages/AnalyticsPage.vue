<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from '../composables/useTransactions'
import { useFormat, toLocalDateString } from '../composables/useFormat'
import { savingsRate as calcSavingsRate, avgDailySpend as calcAvgDaily, percentChange } from '../shared/finance'
import { useCategories } from '../composables/useCategories'
import { useBudget } from '../composables/useBudget'
import CategoryBreakdown from '../components/charts/CategoryBreakdown.vue'
import SimplePagination from '../components/ui/SimplePagination.vue'
import IncomeExpenseChart from '../components/charts/IncomeExpenseChart.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-vue-next'

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

// Parse a 'YYYY-MM-DD' string as a local-time date (not UTC midnight) so it
// compares correctly against the local-time range boundaries below — using
// `new Date(dateStr)` directly would parse as UTC and could shift a
// transaction into the wrong period for users behind UTC.
const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const inRange = (dateStr, range) => {
  if (!dateStr) return false // defensive: a malformed imported record could lack a date
  const d = parseLocalDate(dateStr)
  return d >= range.start && d <= range.end
}

// Filter transactions for the selected period
const periodTransactions = computed(() => transactions.value.filter(t => inRange(t.date, periodRange.value)))
const prevPeriodTransactions = computed(() => transactions.value.filter(t => inRange(t.date, prevPeriodRange.value)))

// Expense / Income transactions for the SELECTED PERIOD — feed the category
// breakdowns and top categories, so every number on this page describes the
// same time span as the period selector and summary cards.
const expenseTransactions = computed(() => periodTransactions.value.filter(t => t.type === 'expense'))
const incomeTransactions = computed(() => periodTransactions.value.filter(t => t.type === 'income'))

// Stable colour order for the category charts: categories ranked by ALL-TIME
// total, so a category keeps its colour when the period changes.
const rankAllTime = (type) => {
  const totals = {}
  transactions.value.forEach(t => {
    if (t.type === type) totals[t.category] = (totals[t.category] || 0) + Number(t.amount)
  })
  return Object.keys(totals).sort((a, b) => totals[b] - totals[a])
}
const expenseColorOrder = computed(() => rankAllTime('expense'))
const incomeColorOrder = computed(() => rankAllTime('income'))

// Period totals
const periodIncome = computed(() => periodTransactions.value.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0))
const periodExpense = computed(() => periodTransactions.value.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0))
const prevPeriodExpense = computed(() => prevPeriodTransactions.value.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0))

// Top spending categories (selected period)
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
// Report metrics come from src/shared/finance.js — identical to the Telegram /report
const savingsRate = computed(() => calcSavingsRate(periodIncome.value, periodExpense.value))

// Counts elapsed calendar days (the old time-based rounding over-counted by one after midday)
const avgDailySpend = computed(() => calcAvgDaily(
  periodExpense.value,
  { start: toLocalDateString(periodRange.value.start), end: toLocalDateString(periodRange.value.end) },
  toLocalDateString(new Date())
))

const expenseChange = computed(() => percentChange(periodExpense.value, prevPeriodExpense.value))

const periodComparisonLabel = computed(() => ({
  month: t('insight_vs_last_month'),
  quarter: t('insight_vs_last_quarter'),
  year: t('insight_vs_last_year'),
}[periodMode.value]))

// ── Recent Daily Spend — last 3 distinct days with any activity ──────────────
// ── Daily activity for the selected period, paginated ─────────────────────────
// Rows are paged (not days) so a busy day can't make one page enormous; each
// day heading still shows that WHOLE day's net, even if it spans two pages.
const DAILY_PAGE_SIZE = 10
const dailyPage = ref(1)

const dailyRows = computed(() =>
  [...periodTransactions.value].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  )
)
const dailyPages = computed(() => Math.max(1, Math.ceil(dailyRows.value.length / DAILY_PAGE_SIZE)))

const dayNet = computed(() => {
  const net = {}
  dailyRows.value.forEach(t => {
    net[t.date] = (net[t.date] || 0) + (t.type === 'income' || t.type === 'borrow' ? Number(t.amount) : -Number(t.amount))
  })
  return net
})

const recentDailyGroups = computed(() => {
  const start = (dailyPage.value - 1) * DAILY_PAGE_SIZE
  const groups = []
  dailyRows.value.slice(start, start + DAILY_PAGE_SIZE).forEach(t => {
    let g = groups[groups.length - 1]
    if (!g || g.date !== t.date) {
      g = { date: t.date, label: formatRelativeDate(t.date), rows: [], net: dayNet.value[t.date] }
      groups.push(g)
    }
    g.rows.push(t)
  })
  return groups
})

// New period (or data shrinking) → back to a valid page
watch([periodRange, dailyPages], () => {
  if (dailyPage.value > dailyPages.value) dailyPage.value = dailyPages.value
})
watch(periodRange, () => { dailyPage.value = 1 })

const rowLabel = (t) => t.name || t.description || getCategoryInfo(t.category, t.type).label

// Months shown in the Income vs Expenses chart, driven by the period selector:
//   month   → the selected month and the 5 before it (6 months)
//   quarter → the 3 months of the selected quarter
//   year    → January–December of the selected year
const chartMonths = computed(() => {
  const y = currentYear.value
  if (periodMode.value === 'year') return Array.from({ length: 12 }, (_, m) => ({ year: y, month: m }))
  if (periodMode.value === 'quarter') {
    const q = Math.floor(currentMonth.value / 3) * 3
    return [0, 1, 2].map(i => ({ year: y, month: q + i }))
  }
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, currentMonth.value - 5 + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
})

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
            :aria-label="t('previous')"
            @click="prevPeriod"
          >
            <AppIcon :icon="ChevronLeft" size="nav" class="text-gray-600 dark:text-gray-400" />
          </button>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ periodLabel }}
          </h2>
          <button
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            :aria-label="t('next')"
            @click="nextPeriod"
          >
            <AppIcon :icon="ChevronRight" size="nav" class="text-gray-600 dark:text-gray-400" />
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
      <!-- One card, three stats: rows on phones, columns from sm. Neutral styling;
           only the "vs last period" value carries good/bad colour (+ icon + sign). -->
      <BaseCard padding="p-0">
        <dl class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
          <div class="flex sm:flex-col items-center sm:items-start justify-between gap-1 px-4 py-3.5 sm:py-4">
            <dt class="text-sm sm:text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('insight_savings_rate') }}</dt>
            <dd class="tabular text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{{ savingsRate === null ? '—' : savingsRate + '%' }}</dd>
          </div>
          <div class="flex sm:flex-col items-center sm:items-start justify-between gap-1 px-4 py-3.5 sm:py-4">
            <dt class="text-sm sm:text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('insight_avg_daily') }}</dt>
            <dd class="tabular text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{{ avgDailySpend === null ? '—' : formatCurrency(avgDailySpend) }}</dd>
          </div>
          <div class="flex sm:flex-col items-center sm:items-start justify-between gap-1 px-4 py-3.5 sm:py-4">
            <dt class="text-sm sm:text-xs font-medium text-gray-500 dark:text-gray-400">{{ periodComparisonLabel }}</dt>
            <dd
              class="tabular text-lg sm:text-2xl font-bold flex items-center gap-1.5"
              :class="expenseChange === null ? 'text-gray-900 dark:text-white' : expenseChange > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
            >
              <AppIcon
                v-if="expenseChange !== null"
                :icon="expenseChange > 0 ? TrendingUp : TrendingDown"
                size="button"
              />
              {{ expenseChange === null ? '—' : (expenseChange > 0 ? '+' : '') + expenseChange + '%' }}
            </dd>
          </div>
        </dl>
      </BaseCard>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <!-- Expense Breakdown (selected period) -->
        <BaseCard>
          <div class="flex items-baseline justify-between gap-3 mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('expense_by_category') }}</h3>
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ periodLabel }}</span>
          </div>
          <CategoryBreakdown
            v-if="expenseTransactions.length > 0"
            :transactions="expenseTransactions"
            type="expense"
            :color-order="expenseColorOrder"
          />
          <p v-else class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('no_expense_data') }}
          </p>
        </BaseCard>

        <!-- Income Breakdown (selected period) -->
        <BaseCard>
          <div class="flex items-baseline justify-between gap-3 mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('income_by_category') }}</h3>
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ periodLabel }}</span>
          </div>
          <CategoryBreakdown
            v-if="incomeTransactions.length > 0"
            :transactions="incomeTransactions"
            type="income"
            :color-order="incomeColorOrder"
          />
          <p v-else class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('no_income_data') }}
          </p>
        </BaseCard>
      </div>

      <!-- Income vs Expenses (grouped monthly bars, follows the period selector) -->
      <BaseCard>
        <div class="flex items-baseline justify-between gap-3 mb-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('income_vs_expenses') }}</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ t('chart_range_' + periodMode) }}</span>
        </div>
        <IncomeExpenseChart :transactions="transactions" :months="chartMonths" />
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
                <AppIcon :name="getCatIcon(item.category)" fallback="tag" size="button" class="text-gray-500 dark:text-gray-400" />
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
        <div class="flex items-baseline justify-between gap-3 mb-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('recent_daily_spend') }}</h3>
          <span class="tabular text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {{ periodLabel }} · {{ t('n_records', { n: dailyRows.length }) }}
          </span>
        </div>
        <!-- Fixed min-height keeps the pager from jumping between short and full pages -->
        <div class="space-y-4 min-h-[22rem]">
          <section v-for="group in recentDailyGroups" :key="group.date">
            <div class="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">{{ group.label }}</span>
              <span class="tabular text-xs font-bold whitespace-nowrap" :class="group.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'">
                {{ group.net >= 0 ? '+' : '' }}{{ formatCurrency(group.net) }}
              </span>
            </div>
            <ul>
              <li v-for="tx in group.rows" :key="tx.id" class="flex items-center justify-between gap-3 py-2 text-sm">
                <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">{{ rowLabel(tx) }}</span>
                <span
                  class="tabular font-semibold whitespace-nowrap shrink-0"
                  :class="(tx.type === 'income' || tx.type === 'borrow') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
                >{{ (tx.type === 'income' || tx.type === 'borrow') ? '+' : '-' }}{{ formatCurrency(tx.amount) }}</span>
              </li>
            </ul>
          </section>
        </div>
        <SimplePagination v-model:page="dailyPage" :pages="dailyPages" />
      </BaseCard>

      <!-- Overall Summary -->
      <BaseCard class="!bg-primary-700 dark:!bg-primary-800 !border-transparent text-white">
        <h3 class="text-lg font-semibold mb-4">{{ t('all_transactions') }}</h3>
        <div class="grid grid-cols-1 min-[400px]:grid-cols-3 gap-4 [&_p:last-child]:tabular-nums [&_p:last-child]:break-all">
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
