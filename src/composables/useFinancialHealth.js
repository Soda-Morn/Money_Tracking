import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from './useTransactions'
import { useBudget } from './useBudget'

// ── Financial Health Score ──────────────────────────────────────────────────
// A transparent 0-100 blend of 3 factors (no ML, no hidden weighting):
//   40% — this month's savings rate        (income vs expense)
//   30% — % of this month's category budgets currently within their limit
//   30% — expense trend vs last month      (spending less = higher score)
// Any factor with insufficient data (e.g. no budgets set, no prior month)
// falls back to a neutral baseline so it doesn't unfairly tank the score.
const WEIGHTS = { savings: 0.4, budget: 0.3, trend: 0.3 }
const NEUTRAL_BUDGET_SCORE = 70
const NEUTRAL_TREND_SCORE = 60

export function useFinancialHealth() {
  const { t } = useI18n()
  const { transactions } = useTransactions()
  const { budgets } = useBudget()

  const now = new Date()
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const thisMonthKey = monthKey(now)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = monthKey(lastMonthDate)

  const monthTotals = (key) => {
    const rows = transactions.value.filter(t => t.date.startsWith(key))
    const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { income, expense, rows }
  }

  const thisMonth = computed(() => monthTotals(thisMonthKey))
  const lastMonth = computed(() => monthTotals(lastMonthKey))

  // Factor 1 — savings rate (0-100, clamped; null → neutral 50)
  const savingsRate = computed(() => {
    const { income, expense } = thisMonth.value
    if (!income) return null
    return Math.round(((income - expense) / income) * 100)
  })
  const savingsScore = computed(() => {
    if (savingsRate.value === null) return 50
    return Math.max(0, Math.min(100, savingsRate.value))
  })

  // Factor 2 — % of category budgets within limit this month
  const budgetAdherence = computed(() => {
    const entry = budgets.value[thisMonthKey]
    const categories = entry?.categories ?? {}
    const values = Object.entries(categories)
    if (values.length === 0) return null
    const spendByCategory = {}
    thisMonth.value.rows.filter(t => t.type === 'expense').forEach(t => {
      spendByCategory[t.category] = (spendByCategory[t.category] || 0) + Number(t.amount)
    })
    const withinLimit = values.filter(([cat, limit]) => (spendByCategory[cat] || 0) <= limit).length
    return Math.round((withinLimit / values.length) * 100)
  })
  const budgetScore = computed(() => budgetAdherence.value === null ? NEUTRAL_BUDGET_SCORE : budgetAdherence.value)

  // Factor 3 — expense trend vs last month (spending less = better)
  const expenseChangePct = computed(() => {
    const prev = lastMonth.value.expense
    if (!prev) return null
    return Math.round(((thisMonth.value.expense - prev) / prev) * 100)
  })
  const trendScore = computed(() => {
    if (expenseChangePct.value === null) return NEUTRAL_TREND_SCORE
    // -100% change (spent nothing) → 100 score; +100% change (spent double) → 0 score
    return Math.max(0, Math.min(100, 50 - expenseChangePct.value / 2))
  })

  const score = computed(() => Math.round(
    savingsScore.value * WEIGHTS.savings +
    budgetScore.value * WEIGHTS.budget +
    trendScore.value * WEIGHTS.trend
  ))

  // Pick whichever factor deviates most from its neutral baseline to phrase the description
  const description = computed(() => {
    const deviations = [
      { key: 'savings', value: Math.abs(savingsScore.value - 50) },
      { key: 'budget',  value: budgetAdherence.value === null ? 0 : Math.abs(budgetScore.value - NEUTRAL_BUDGET_SCORE) },
      { key: 'trend',   value: expenseChangePct.value === null ? 0 : Math.abs(trendScore.value - NEUTRAL_TREND_SCORE) },
    ].sort((a, b) => b.value - a.value)

    const top = deviations[0]

    if (top.key === 'trend' && expenseChangePct.value !== null) {
      return expenseChangePct.value <= 0
        ? t('health_desc_spending_down', { pct: Math.abs(expenseChangePct.value) })
        : t('health_desc_spending_up', { pct: expenseChangePct.value })
    }
    if (top.key === 'budget' && budgetAdherence.value !== null) {
      return t('health_desc_budget', { pct: budgetAdherence.value })
    }
    if (top.key === 'savings' && savingsRate.value !== null) {
      return savingsRate.value >= 0
        ? t('health_desc_savings_good', { pct: savingsRate.value })
        : t('health_desc_savings_bad', { pct: Math.abs(savingsRate.value) })
    }
    return t('health_desc_neutral')
  })

  return { score, description, savingsRate, budgetAdherence, expenseChangePct }
}
