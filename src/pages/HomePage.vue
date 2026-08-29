<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import { useCategories } from '../composables/useCategories'
import { useBudget } from '../composables/useBudget'
import { useFinancialHealth } from '../composables/useFinancialHealth'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BorrowForm from '../components/transactions/BorrowForm.vue'
import TransactionItem from '../components/transactions/TransactionItem.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { useToast } from '../composables/useToast'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions()
const { formatCurrency } = useFormat()
const { getCategoryInfo } = useCategories()
const { budgets } = useBudget()
const { score: healthScore, description: healthDescription } = useFinancialHealth()

// ── Current-month totals (Dashboard always reflects the current month) ───────
const now = new Date()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const monthTransactions = computed(() => transactions.value.filter(t => t.date.startsWith(monthKey)))
const monthIncome = computed(() => monthTransactions.value.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))
const monthExpense = computed(() => monthTransactions.value.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))
const monthBorrow = computed(() => monthTransactions.value.filter(t => t.type === 'borrow').reduce((s, t) => s + Number(t.amount), 0))
const monthPayback = computed(() => monthTransactions.value.filter(t => t.type === 'payback').reduce((s, t) => s + Number(t.amount), 0))
const totalBalance = computed(() => monthIncome.value - monthExpense.value + monthBorrow.value - monthPayback.value)

// ── Budget overview (current month only — full history lives on Activity/Budget pages) ──
const showBudgetOverview = ref(true)
const monthBudget = computed(() => budgets.value[monthKey] ?? null)
const monthBudgetTotal = computed(() => monthBudget.value?.total ?? null)
const monthCategoryBudgets = computed(() => monthBudget.value?.categories ?? {})

const categoryExpenseMap = computed(() => {
  const map = {}
  monthTransactions.value.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + Number(t.amount)
  })
  return map
})

const categoryBudgetRows = computed(() =>
  Object.entries(monthCategoryBudgets.value).map(([value, limit]) => {
    const spent = categoryExpenseMap.value[value] || 0
    const pct = Math.min(100, Math.round((spent / limit) * 100))
    const info = getCategoryInfo(value, 'expense')
    return { value, limit, spent, pct, icon: info.icon, label: info.label }
  })
)

const budgetPct = computed(() => {
  if (!monthBudgetTotal.value) return 0
  return Math.min(100, Math.round((monthExpense.value / monthBudgetTotal.value) * 100))
})

// ── Recent transactions preview ───────────────────────────────────────────────
const recentTransactions = computed(() =>
  [...transactions.value]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5)
)

// ── Quick Actions ──────────────────────────────────────────────────────────────
const showQuickModal = ref(false)
const quickType = ref('expense') // 'expense' | 'income' | 'borrow'

const openQuickAction = (type) => {
  quickType.value = type
  showQuickModal.value = true
}

const quickModalTitle = computed(() => ({
  expense: t('add_transaction'),
  income: t('add_transaction'),
  borrow: t('add_borrow_payback'),
}[quickType.value]))

const handleQuickTransaction = async (data) => {
  await addTransaction(data)
  showQuickModal.value = false
  toast.success(t('toast_transaction_added'))
}

const handleQuickBorrow = async (data) => {
  await addTransaction(data)
  showQuickModal.value = false
  toast.success(t('toast_record_added'))
}

// ── Recent transaction row actions (edit/delete inline, view goes to Activity) ──
const showEditModal = ref(false)
const editingTransaction = ref(null)

const handleEdit = (transaction) => {
  editingTransaction.value = transaction
  showEditModal.value = true
}

const handleUpdate = async (data) => {
  await updateTransaction(editingTransaction.value.id, data)
  showEditModal.value = false
  editingTransaction.value = null
  toast.success(t('toast_transaction_updated'))
}

const handleDelete = async (id) => {
  if (!confirm(t('delete_confirm_desc'))) return
  await deleteTransaction(id)
  toast.success(t('toast_transaction_deleted'))
}

const goToActivity = () => router.push('/activity')
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Page Header -->
    <div class="hidden lg:block">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('pages.dashboard') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('track_income_expenses') }}</p>
    </div>

    <!-- Total Balance -->
    <BaseCard>
      <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{{ t('total_balance') }}</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">{{ formatCurrency(totalBalance) }}</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5">
          <div class="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] text-green-700 dark:text-green-400 font-medium leading-none mb-1">{{ t('income') }}</p>
            <p class="text-sm font-bold text-green-700 dark:text-green-400 truncate">+{{ formatCurrency(monthIncome) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
          <div class="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 10l-7-7m0 0l-7 7m7-7v18" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] text-red-700 dark:text-red-400 font-medium leading-none mb-1">{{ t('expense') }}</p>
            <p class="text-sm font-bold text-red-700 dark:text-red-400 truncate">-{{ formatCurrency(monthExpense) }}</p>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- Financial Health -->
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-800 to-primary-950 rounded-2xl p-4 shadow-lg shadow-primary-900/20">
      <div class="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-white">{{ t('financial_health') }}</span>
        <div class="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>
      <p class="text-3xl font-bold text-white mb-2">{{ healthScore }}<span class="text-base font-medium text-primary-200">/100</span></p>
      <p class="text-xs text-primary-100 leading-relaxed">{{ healthDescription }}</p>
    </div>

    <!-- Quick Actions -->
    <div>
      <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-0.5">{{ t('quick_actions') }}</h3>
      <div class="grid grid-cols-3 gap-3">
        <button
          class="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-3.5 shadow-sm hover:shadow-md transition-shadow"
          @click="openQuickAction('expense')"
        >
          <div class="w-9 h-9 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
            <svg class="w-4.5 h-4.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </div>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('expense') }}</span>
        </button>
        <button
          class="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-3.5 shadow-sm hover:shadow-md transition-shadow"
          @click="openQuickAction('income')"
        >
          <div class="w-9 h-9 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
            <svg class="w-4.5 h-4.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('income') }}</span>
        </button>
        <button
          class="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-3.5 shadow-sm hover:shadow-md transition-shadow"
          @click="openQuickAction('borrow')"
        >
          <div class="w-9 h-9 bg-tertiary-50 dark:bg-tertiary-900/20 rounded-xl flex items-center justify-center">
            <svg class="w-4.5 h-4.5 text-tertiary-600 dark:text-tertiary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('nav.borrow') }}</span>
        </button>
      </div>
    </div>

    <!-- Budget Overview -->
    <BaseCard v-if="monthBudgetTotal !== null" padding="p-0">
      <button
        class="w-full flex items-center justify-between px-4 py-3 text-left"
        @click="showBudgetOverview = !showBudgetOverview"
      >
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-tertiary-100 dark:bg-tertiary-900/40 rounded-xl flex items-center justify-center">
            <svg class="w-4 h-4 text-tertiary-600 dark:text-tertiary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('budget_overview') }}</span>
        </div>
        <svg
          class="w-4 h-4 text-gray-400 transition-transform duration-200"
          :class="showBudgetOverview ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-if="showBudgetOverview" class="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('total_spending') }}</span>
            <div class="text-right">
              <span class="text-xs font-semibold" :class="budgetPct >= 100 ? 'text-red-500' : budgetPct >= 80 ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'">
                {{ formatCurrency(monthExpense) }} / {{ formatCurrency(monthBudgetTotal) }}
              </span>
              <span class="text-xs ml-1.5 font-bold" :class="budgetPct >= 100 ? 'text-red-500' : budgetPct >= 80 ? 'text-amber-500' : 'text-green-600'">
                {{ budgetPct }}%
              </span>
            </div>
          </div>
          <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-green-500'"
              :style="{ width: budgetPct + '%' }"
            />
          </div>
          <p v-if="budgetPct < 100" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {{ formatCurrency(monthBudgetTotal - monthExpense) }} remaining
          </p>
          <p v-else class="text-xs text-red-500 mt-1 font-medium">
            Over budget by {{ formatCurrency(monthExpense - monthBudgetTotal) }}
          </p>
        </div>

        <div v-if="categoryBudgetRows.length > 0" class="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('category_limits') }}</p>
          <div v-for="row in categoryBudgetRows" :key="row.value" class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span>{{ row.icon }}</span>{{ row.label }}
              </span>
              <span class="text-xs font-semibold" :class="row.pct >= 100 ? 'text-red-500' : row.pct >= 80 ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'">
                {{ formatCurrency(row.spent) }} / {{ formatCurrency(row.limit) }}
                <span class="font-bold ml-1" :class="row.pct >= 100 ? 'text-red-500' : row.pct >= 80 ? 'text-amber-500' : 'text-green-600'">
                  {{ row.pct }}%
                </span>
              </span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="row.pct >= 100 ? 'bg-red-500' : row.pct >= 80 ? 'bg-amber-400' : 'bg-primary-500'"
                :style="{ width: row.pct + '%' }"
              />
            </div>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- Recent Transactions -->
    <BaseCard>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('recent_transactions') }}</h2>
        <button class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline" @click="goToActivity">
          {{ t('view_all') }}
        </button>
      </div>

      <EmptyState v-if="recentTransactions.length === 0" :title="t('no_transactions_title')" icon="folder" />
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <TransactionItem
          v-for="tx in recentTransactions"
          :key="tx.id"
          :transaction="tx"
          @view="goToActivity"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </div>
    </BaseCard>

    <!-- Quick Action Modal -->
    <BaseModal :show="showQuickModal" :title="quickModalTitle" @close="showQuickModal = false">
      <TransactionForm
        v-if="quickType === 'expense' || quickType === 'income'"
        :initial-data="{ type: quickType }"
        @submit="handleQuickTransaction"
        @cancel="showQuickModal = false"
      />
      <BorrowForm
        v-else
        :initial-data="{ type: 'borrow' }"
        @submit="handleQuickBorrow"
        @cancel="showQuickModal = false"
      />
    </BaseModal>

    <!-- Edit Transaction Modal (from Recent Transactions) -->
    <BaseModal :show="showEditModal" :title="t('edit_transaction')" @close="showEditModal = false">
      <TransactionForm
        v-if="editingTransaction"
        :initial-data="editingTransaction"
        :is-editing="true"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </BaseModal>
  </div>
</template>
