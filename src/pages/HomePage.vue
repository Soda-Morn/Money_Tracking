<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactions } from '../composables/useTransactions'
import { useFormat, sortByDateDesc } from '../composables/useFormat'
import { useCategories } from '../composables/useCategories'
import { useBudget } from '../composables/useBudget'
import { useFinancialHealth } from '../composables/useFinancialHealth'
import { useSavingsGoals } from '../composables/useSavingsGoals'
import { useAuth } from '../composables/useAuth'
import { useQuickAdd } from '../composables/useQuickAdd'
import { useAnimatedNumber } from '../composables/useAnimatedNumber'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BorrowForm from '../components/transactions/BorrowForm.vue'
import TransactionItem from '../components/transactions/TransactionItem.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import UpcomingSpending from '../components/planner/UpcomingSpending.vue'
import {
  TrendingUp, TrendingDown, ShieldCheck, HandCoins, Target, ChevronDown, ChevronRight, PiggyBank, Plus,
} from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { transactions, loading, syncing, updateTransaction, deleteTransaction } = useTransactions()
const { formatCurrency, getMonthName } = useFormat()
const { getCategoryInfo } = useCategories()
const { budgets } = useBudget()
const { score: healthScore, description: healthDescription } = useFinancialHealth()
const { goals, totalSaved, totalTarget, completedGoals } = useSavingsGoals()
const { currentUser } = useAuth()
const { open: openQuickAdd } = useQuickAdd()

const firstName = computed(() => (currentUser.value?.displayName || '').split(' ')[0])

// ── Current-month totals (Dashboard always reflects the current month) ───────
const now = new Date()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const monthLabel = computed(() => getMonthName(now.getMonth())) // re-localises on language switch

const monthTransactions = computed(() => transactions.value.filter(t => t.date.startsWith(monthKey)))
const monthIncome = computed(() => monthTransactions.value.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))
const monthExpense = computed(() => monthTransactions.value.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))
const monthBorrow = computed(() => monthTransactions.value.filter(t => t.type === 'borrow').reduce((s, t) => s + Number(t.amount), 0))
const monthPayback = computed(() => monthTransactions.value.filter(t => t.type === 'payback').reduce((s, t) => s + Number(t.amount), 0))
const totalBalance = computed(() => monthIncome.value - monthExpense.value + monthBorrow.value - monthPayback.value)

// Display-only count-up of the hero number (real value untouched)
const animatedBalance = useAnimatedNumber(totalBalance)

// ── Budget overview (current month only — full history lives on Activity/Budget pages) ──
const showBudgetDetails = ref(false)
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
  if (monthBudgetTotal.value == null) return 0
  return Math.min(100, Math.round((monthExpense.value / monthBudgetTotal.value) * 100))
})

const budgetTone = (pct) => (pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'ok')

// Toast warning once per visit when spending hits 80% of this month's budget
// (mirrors the pre-redesign behavior — otherwise crossing the threshold while
// the Budget Overview card is collapsed/off-screen goes unnoticed).
let budgetWarned = false
watch(budgetPct, (pct) => {
  if (pct >= 80 && !budgetWarned && monthBudgetTotal.value) {
    budgetWarned = true
    toast.info(`${pct}% ${t('budget_warning')}`)
  }
})

// ── Savings snapshot (display only — totals come from useSavingsGoals) ────────
const savingsPct = computed(() =>
  totalTarget.value > 0 ? Math.min(100, Math.round((totalSaved.value / totalTarget.value) * 100)) : 0
)

// ── Recent transactions preview ───────────────────────────────────────────────
const recentTransactions = computed(() =>
  [...transactions.value].sort(sortByDateDesc).slice(0, 5)
)

// ── Recent transaction row actions (edit/delete inline, view goes to Activity) ──
const showEditModal = ref(false)
const editingTransaction = ref(null)
const savingEdit = ref(false)
const isEditingBorrow = computed(() => editingTransaction.value?.type === 'borrow' || editingTransaction.value?.type === 'payback')

const handleEdit = (transaction) => {
  editingTransaction.value = transaction
  showEditModal.value = true
}

const handleUpdate = async (data) => {
  if (savingEdit.value) return
  savingEdit.value = true
  try {
    await updateTransaction(editingTransaction.value.id, data)
    toast.success(t(isEditingBorrow.value ? 'toast_record_updated' : 'toast_transaction_updated'))
    showEditModal.value = false
    editingTransaction.value = null
  } catch (e) {
    toast.error(t('toast_save_error'))
  } finally {
    savingEdit.value = false
  }
}

// ── Delete confirmation ────────────────────────────────────────────────────────
const showDeleteDialog = ref(false)
const deletingId = ref(null)
const deletingLabel = ref('')
const deleting = ref(false)

const handleDelete = (id) => {
  const tx = transactions.value.find(t => t.id === id)
  deletingId.value = id
  deletingLabel.value = tx
    ? (tx.type === 'expense' || tx.type === 'income' ? getCategoryInfo(tx.category, tx.type).label : (tx.name || ''))
    : ''
  showDeleteDialog.value = true
}

const resetDelete = () => {
  showDeleteDialog.value = false
  deletingId.value = null
  deletingLabel.value = ''
}

const confirmDelete = async () => {
  if (!deletingId.value || deleting.value) return
  deleting.value = true
  try {
    await deleteTransaction(deletingId.value)
    toast.success(t('toast_transaction_deleted'))
    resetDelete()
  } catch (e) {
    toast.error(t('toast_delete_error'))
  } finally {
    deleting.value = false
  }
}

const cancelDelete = () => { if (!deleting.value) resetDelete() }

const goToActivity = () => router.push('/activity')

const quickActions = computed(() => [
  { type: 'expense', label: t('expense'), icon: TrendingDown, tint: 'bg-red-50 text-red-500 dark:bg-red-900/25 dark:text-red-400' },
  { type: 'income', label: t('income'), icon: TrendingUp, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400' },
  { type: 'lending', label: t('lending_short'), icon: HandCoins, tint: 'bg-tertiary-50 text-tertiary-600 dark:bg-tertiary-900/30 dark:text-tertiary-300' },
])
</script>

<template>
  <div class="space-y-4 lg:space-y-0">
    <!-- Greeting / page header -->
    <div class="reveal flex items-end justify-between lg:mb-6">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ firstName ? t('greeting_name', { name: firstName }) : t('greeting') }}
        </p>
        <h1 class="hidden lg:block text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{{ t('pages.dashboard') }}</h1>
      </div>
    </div>

    <!-- Mobile: single column in priority order. Desktop: 2/3 + 1/3 grid. -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6 lg:grid-flow-dense lg:items-start">

      <!-- ① Balance hero -->
      <section class="reveal lg:col-span-2" :style="{ '--i': 1 }" :aria-label="t('balance_this_month', { month: monthLabel })">
        <div v-if="loading" class="skeleton h-[188px] rounded-3xl" />
        <div v-else class="relative overflow-hidden rounded-3xl bg-primary-700 dark:bg-primary-800 p-5 sm:p-6 text-white shadow-lg shadow-primary-900/15">
          <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/[0.06] pointer-events-none" />
          <p class="relative flex items-center justify-between gap-2 text-sm font-medium text-primary-100">
            {{ t('balance_this_month', { month: monthLabel }) }}
            <!-- Numbers from the on-device cache until the server confirms them -->
            <span v-if="syncing" class="inline-flex items-center gap-1.5 text-xs text-primary-200" role="status">
              <span class="w-1.5 h-1.5 rounded-full bg-primary-200 animate-pulse" />{{ t('syncing') }}
            </span>
          </p>
          <p class="relative tabular mt-1 text-[2.125rem] sm:text-4xl font-bold tracking-tight leading-tight break-all">
            {{ formatCurrency(animatedBalance) }}
          </p>
          <div class="relative mt-5 grid grid-cols-2 gap-2.5">
            <div class="rounded-2xl bg-white/10 px-3.5 py-3 min-w-0">
              <p class="flex items-center gap-1.5 text-xs font-medium text-primary-100">
                <AppIcon :icon="TrendingUp" size="xs" class="text-emerald-300" />{{ t('income') }}
              </p>
              <p class="tabular mt-0.5 text-[15px] font-semibold truncate">+{{ formatCurrency(monthIncome) }}</p>
            </div>
            <div class="rounded-2xl bg-white/10 px-3.5 py-3 min-w-0">
              <p class="flex items-center gap-1.5 text-xs font-medium text-primary-100">
                <AppIcon :icon="TrendingDown" size="xs" class="text-red-300" />{{ t('expense') }}
              </p>
              <p class="tabular mt-0.5 text-[15px] font-semibold truncate">-{{ formatCurrency(monthExpense) }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ② Quick actions -->
      <section class="reveal lg:col-start-3" :style="{ '--i': 2 }">
        <h2 class="sr-only lg:not-sr-only lg:mb-3 lg:text-sm lg:font-semibold lg:text-gray-500 lg:dark:text-gray-400">{{ t('quick_actions') }}</h2>
        <div class="grid grid-cols-3 gap-2.5">
          <button
            v-for="action in quickActions"
            :key="action.type"
            type="button"
            class="pressable flex flex-col items-center gap-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 py-3.5 hover:border-gray-200 dark:hover:border-gray-700"
            @click="openQuickAdd(action.type)"
          >
            <span :class="['w-11 h-11 rounded-xl flex items-center justify-center', action.tint]">
              <AppIcon :icon="action.icon" size="nav" />
            </span>
            <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ action.label }}</span>
          </button>
        </div>
      </section>

      <!-- ③ Budget -->
      <section v-if="monthBudgetTotal !== null" class="reveal lg:col-start-3" :style="{ '--i': 3 }">
        <BaseCard padding="p-0">
          <div class="p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center shrink-0">
                  <AppIcon :icon="Target" size="button" />
                </span>
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ t('budget_overview') }}</h2>
              </div>
              <span
                class="tabular text-xs font-bold px-2 py-1 rounded-lg"
                :class="{
                  'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400': budgetTone(budgetPct) === 'red',
                  'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400': budgetTone(budgetPct) === 'amber',
                  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400': budgetTone(budgetPct) === 'ok',
                }"
              >{{ budgetPct }}%</span>
            </div>

            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {{ budgetPct < 100 ? t('left_to_spend') : t('over_budget') }}
            </p>
            <p class="tabular text-2xl font-bold tracking-tight" :class="budgetPct < 100 ? 'text-gray-900 dark:text-white' : 'text-red-500'">
              {{ formatCurrency(Math.abs(monthBudgetTotal - monthExpense)) }}
            </p>

            <div class="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" :aria-valuenow="budgetPct" aria-valuemin="0" aria-valuemax="100">
              <div
                class="h-full rounded-full transition-[width] duration-500 ease-out"
                :class="{ 'bg-red-500': budgetTone(budgetPct) === 'red', 'bg-amber-400': budgetTone(budgetPct) === 'amber', 'bg-primary-500': budgetTone(budgetPct) === 'ok' }"
                :style="{ width: budgetPct + '%' }"
              />
            </div>
            <p class="tabular mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              {{ t('spent_of_budget', { spent: formatCurrency(monthExpense), total: formatCurrency(monthBudgetTotal) }) }}
            </p>
          </div>

          <template v-if="categoryBudgetRows.length > 0">
            <button
              type="button"
              class="w-full flex items-center justify-between px-4 h-11 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              :aria-expanded="showBudgetDetails ? 'true' : 'false'"
              @click="showBudgetDetails = !showBudgetDetails"
            >
              {{ t('category_limits') }} ({{ categoryBudgetRows.length }})
              <AppIcon :icon="ChevronDown" size="action" class="transition-transform duration-200" :class="showBudgetDetails ? 'rotate-180' : ''" />
            </button>
            <div v-if="showBudgetDetails" class="px-4 pb-4 space-y-3 animate-fade-in">
              <div v-for="row in categoryBudgetRows" :key="row.value">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="flex items-center gap-1.5 min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300">
                    <AppIcon :name="row.icon" fallback="tag" size="xs" class="text-gray-400 shrink-0" />
                    <span class="truncate">{{ row.label }}</span>
                  </span>
                  <span class="tabular text-xs whitespace-nowrap" :class="row.pct >= 100 ? 'text-red-500 font-semibold' : row.pct >= 80 ? 'text-amber-500 font-semibold' : 'text-gray-500 dark:text-gray-400'">
                    {{ formatCurrency(row.spent) }} / {{ formatCurrency(row.limit) }}
                  </span>
                </div>
                <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-[width] duration-500 ease-out"
                    :class="row.pct >= 100 ? 'bg-red-500' : row.pct >= 80 ? 'bg-amber-400' : 'bg-primary-500'"
                    :style="{ width: row.pct + '%' }"
                  />
                </div>
              </div>
            </div>
          </template>
        </BaseCard>
      </section>

      <!-- ④ Recent transactions -->
      <section class="reveal lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:row-span-3" :style="{ '--i': 4 }">
        <BaseCard>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('recent_transactions') }}</h2>
            <router-link
              to="/activity"
              class="inline-flex items-center gap-0.5 h-11 -mr-2 px-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              {{ t('view_all') }}<AppIcon :icon="ChevronRight" size="action" />
            </router-link>
          </div>

          <!-- Loading skeleton -->
          <div v-if="loading" class="space-y-3 py-1" aria-hidden="true">
            <div v-for="n in 4" :key="n" class="flex items-center gap-3">
              <div class="skeleton w-10 h-10 shrink-0" />
              <div class="flex-1 space-y-2">
                <div class="skeleton h-3 w-2/5" />
                <div class="skeleton h-2.5 w-1/4" />
              </div>
              <div class="skeleton h-3 w-16" />
            </div>
          </div>

          <EmptyState
            v-else-if="recentTransactions.length === 0"
            :title="t('no_transactions_title')"
            :description="t('no_transactions_desc')"
            icon="wallet"
          >
            <button
              type="button"
              class="pressable inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
              @click="openQuickAdd('expense')"
            >
              <AppIcon :icon="Plus" size="button" />{{ t('add_transaction') }}
            </button>
          </EmptyState>

          <TransitionGroup v-else tag="div" name="list" class="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
            <TransactionItem
              v-for="tx in recentTransactions"
              :key="tx.id"
              :transaction="tx"
              @view="goToActivity"
              @edit="handleEdit"
              @delete="handleDelete"
            />
          </TransitionGroup>
        </BaseCard>
      </section>

      <!-- Upcoming planned spending (Expense Planner — never affects the balance) -->
      <section class="reveal lg:col-start-3" :style="{ '--i': 5 }">
        <UpcomingSpending />
      </section>

      <!-- ⑤ Savings progress -->
      <section v-if="goals.length" class="reveal lg:col-start-3" :style="{ '--i': 5 }">
        <router-link to="/savings" class="pressable block rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 hover:border-gray-200 dark:hover:border-gray-700">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <AppIcon :icon="PiggyBank" size="button" />
            </span>
            <h2 class="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{{ t('savings_progress') }}</h2>
            <AppIcon :icon="ChevronRight" size="action" class="text-gray-300 dark:text-gray-600" />
          </div>
          <div class="mt-3 flex items-baseline justify-between gap-2">
            <p class="tabular text-xl font-bold text-gray-900 dark:text-white truncate">{{ formatCurrency(totalSaved) }}</p>
            <p class="tabular text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ t('of_amount', { amount: formatCurrency(totalTarget) }) }}</p>
          </div>
          <div class="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div class="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out" :style="{ width: savingsPct + '%' }" />
          </div>
          <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            {{ t('goals_completed', { done: completedGoals, total: goals.length }) }}
          </p>
        </router-link>
      </section>

      <!-- ⑥ Financial health (compact) -->
      <section class="reveal lg:col-start-3" :style="{ '--i': 6 }">
        <div class="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
          <div
            class="relative w-14 h-14 shrink-0 rounded-full grid place-items-center"
            :style="{ background: `conic-gradient(var(--color-primary-500) ${healthScore * 3.6}deg, rgb(229 231 235 / 0.6) 0deg)` }"
            role="img"
            :aria-label="`${t('financial_health')}: ${healthScore}/100`"
          >
            <div class="w-11 h-11 rounded-full bg-white dark:bg-gray-900 grid place-items-center">
              <span class="tabular text-base font-bold text-gray-900 dark:text-white">{{ healthScore }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <h2 class="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <AppIcon :icon="ShieldCheck" size="action" class="text-primary-500" />{{ t('financial_health') }}
            </h2>
            <p class="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ healthDescription }}</p>
          </div>
        </div>
      </section>
    </div>

    <!-- Edit Transaction (from Recent Transactions) -->
    <BaseModal :show="showEditModal" :title="isEditingBorrow ? t('add_borrow_payback') : t('edit_transaction')" @close="!savingEdit && (showEditModal = false)">
      <TransactionForm
        v-if="editingTransaction && !isEditingBorrow"
        :initial-data="editingTransaction"
        :is-editing="true"
        :saving="savingEdit"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
      <BorrowForm
        v-else-if="editingTransaction"
        :initial-data="editingTransaction"
        :is-editing="true"
        :saving="savingEdit"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </BaseModal>

    <ConfirmDialog
      :show="showDeleteDialog"
      :title="t('delete_confirm_title')"
      :message="deletingLabel ? t('delete_confirm_name', { name: deletingLabel }) : t('delete_confirm_desc')"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
/* Smooth insert/remove of recent transactions as Firestore updates arrive */
.list-enter-active,
.list-leave-active {
  transition: opacity 0.22s ease, transform 0.22s var(--ease-out);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.list-leave-to {
  opacity: 0;
}
</style>
