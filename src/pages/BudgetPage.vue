<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBudget } from '../composables/useBudget'
import { useCategories, defaultExpenseCategories } from '../composables/useCategories'
import { useFormat } from '../composables/useFormat'
import { useCurrency, USD_TO_KHR } from '../composables/useCurrency'
import { useToast } from '../composables/useToast'
import { useI18n } from 'vue-i18n'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { ChevronLeft, Trash2, Target, Wallet } from 'lucide-vue-next'

const router = useRouter()
const toast = useToast()
const { budgets, setBudget, setCategoryBudget, removeCategoryBudget, removeBudget } = useBudget()
const { expenseCategories } = useCategories()
const { formatCurrency, getMonthName } = useFormat()
const { currency } = useCurrency()
const { t } = useI18n()

// ── Month selection ────────────────────────────────────────────────────────────
const now = new Date()
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonthKey)

// ── Derived state for the selected month ──────────────────────────────────────
const currentCategories = computed(() => budgets.value[selectedMonth.value]?.categories ?? {})

// All expense categories (defaults + user-created)
const allExpenseCategories = computed(() => [
  ...defaultExpenseCategories,
  ...expenseCategories.value
])

// Categories that don't yet have a limit set for the selected month
const availableCategories = computed(() =>
  allExpenseCategories.value.filter(c => !(c.value in currentCategories.value))
)

// Category limit rows for the selected month (for display)
const categoryLimitRows = computed(() =>
  Object.entries(currentCategories.value).map(([value, limit]) => {
    const cat = allExpenseCategories.value.find(c => c.value === value) ?? { icon: 'tag', label: value }
    return { value, limit, icon: cat.icon, label: cat.label }
  })
)

// Amounts are STORED in USD (like every other screen). In KHR display mode the
// user types riel, so convert before saving — previously 400,000 ៛ was saved as $400,000.
const toUsd = (typed) => {
  const n = parseFloat(String(typed).replace(/,/g, ''))
  if (isNaN(n) || n <= 0) return null
  return currency.value === 'KHR' ? Math.round((n / USD_TO_KHR) * 100) / 100 : n
}
const amountPlaceholder = computed(() => (currency.value === 'KHR' ? '0 ៛' : '0.00'))

// ── Monthly total (the dashboard's budget card needs this) ──────────────────
const currentTotal = computed(() => {
  const total = budgets.value[selectedMonth.value]?.total
  return total > 0 ? total : null
})
const totalInput = ref('')
const savingTotal = ref(false)

const handleSaveTotal = async () => {
  const usd = toUsd(totalInput.value)
  if (usd === null) { toast.error(t('error_amount_required')); return }
  savingTotal.value = true
  try {
    await setBudget(selectedMonth.value, usd)
    totalInput.value = ''
    toast.success(t('budget_total_saved'))
  } catch (e) {
    toast.error(t('toast_save_error'))
  } finally {
    savingTotal.value = false
  }
}

// ── Category limit form ───────────────────────────────────────────────────────
const newCategoryValue = ref('')
const newCategoryAmount = ref('')
const savingCategory = ref(false)

const handleAddCategoryLimit = async () => {
  if (!newCategoryValue.value) return
  const usd = toUsd(newCategoryAmount.value)
  if (usd === null) { toast.error(t('error_amount_required')); return }
  savingCategory.value = true
  try {
    await setCategoryBudget(selectedMonth.value, newCategoryValue.value, usd)
    newCategoryValue.value = ''
    newCategoryAmount.value = ''
  } catch (e) {
    toast.error(t('toast_save_error'))
  } finally {
    savingCategory.value = false
  }
}

const handleRemoveCategoryLimit = async (categoryValue) => {
  await removeCategoryBudget(selectedMonth.value, categoryValue)
}

// ── Saved budgets list ────────────────────────────────────────────────────────
const savedBudgets = computed(() =>
  Object.entries(budgets.value)
    .sort((a, b) => b[0].localeCompare(a[0])) // newest first
    .map(([monthKey, entry]) => {
      const [year, month] = monthKey.split('-').map(Number)
      const catCount = Object.keys(entry?.categories ?? {}).length
      return { monthKey, catCount, total: entry?.total ?? 0, label: `${getMonthName(month - 1)} ${year}` }
    })
    .filter(item => item.catCount > 0 || item.total > 0) // months with a total and/or category limits
)

const handleRemove = async (monthKey) => {
  await removeBudget(monthKey)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl mx-auto animate-fade-in">

    <!-- Page header -->
    <div class="flex items-center gap-3">
      <button
        class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        :aria-label="t('back')"
        @click="router.back()"
      >
        <AppIcon :icon="ChevronLeft" size="nav" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('monthly_budget') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('budget_desc') }}</p>
      </div>
    </div>

    <!-- Month picker -->
    <BaseCard>
      <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">{{ t('select_month') }}</label>
      <input
        v-model="selectedMonth"
        type="month"
        class="w-full h-12 px-3.5 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      />
    </BaseCard>

    <!-- Monthly total (previously impossible to set — the dashboard budget card depends on it) -->
    <BaseCard>
      <div class="flex items-start gap-3 mb-3">
        <span class="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300 flex items-center justify-center shrink-0">
          <AppIcon :icon="Wallet" size="button" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('monthly_total') }}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <template v-if="currentTotal !== null">{{ t('monthly_total_current') }} <span class="tabular font-semibold text-gray-900 dark:text-white">{{ formatCurrency(currentTotal) }}</span></template>
            <template v-else>{{ t('monthly_total_desc') }}</template>
          </p>
        </div>
      </div>
      <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          v-model="totalInput"
          inputmode="decimal"
          :placeholder="amountPlaceholder"
          :aria-label="t('monthly_total')"
          class="w-full min-w-0 h-12 px-3.5 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          @keyup.enter="handleSaveTotal"
        />
        <BaseButton :loading="savingTotal" :disabled="!totalInput" class="h-12" @click="handleSaveTotal">
          {{ currentTotal !== null ? t('update') : t('save') }}
        </BaseButton>
      </div>
    </BaseCard>

    <!-- Category limits -->
    <BaseCard padding="p-0">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('category_limits') }}</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('category_limits_desc') }}</p>
      </div>

      <!-- Existing category limits -->
      <div v-if="categoryLimitRows.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="row in categoryLimitRows"
          :key="row.value"
          class="flex items-center justify-between px-4 py-3"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center shrink-0">
              <AppIcon :name="row.icon" fallback="tag" size="button" />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.label }}</p>
              <p class="text-xs text-primary-600 dark:text-primary-400 font-medium mt-0.5">
                {{ formatCurrency(row.limit) }} / {{ t('month') }}
              </p>
            </div>
          </div>
          <button
            class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            :title="t('delete')"
            :aria-label="t('delete')"
            @click="handleRemoveCategoryLimit(row.value)"
          >
            <AppIcon :icon="Trash2" size="action" />
          </button>
        </div>
      </div>

      <!-- Add category limit form -->
      <div
        class="px-4 py-3"
        :class="categoryLimitRows.length > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''"
      >
        <p v-if="categoryLimitRows.length === 0" class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {{ t('no_category_limits') }}
        </p>

        <!-- Phones: category on its own row, then amount + Add. sm+: one row.
             minmax(0,1fr) + min-w-0 stop a long category name from pushing Add off-screen. -->
        <div v-if="availableCategories.length > 0" class="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_8rem_auto] gap-2">
          <select
            v-model="newCategoryValue"
            :aria-label="t('category')"
            class="col-span-2 sm:col-span-1 w-full min-w-0 h-12 px-3.5 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">{{ t('select_category') }}</option>
            <option v-for="cat in availableCategories" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
          <input
            v-model="newCategoryAmount"
            inputmode="decimal"
            :placeholder="amountPlaceholder"
            :aria-label="t('amount')"
            class="w-full min-w-0 h-12 px-3.5 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            @keyup.enter="handleAddCategoryLimit"
          />
          <BaseButton
            class="h-12"
            :loading="savingCategory"
            :disabled="!newCategoryValue || !newCategoryAmount"
            @click="handleAddCategoryLimit"
          >
            {{ t('add') }}
          </BaseButton>
        </div>

        <p v-else class="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
          {{ t('all_categories_limited') }}
        </p>
      </div>
    </BaseCard>

    <!-- Saved budgets list -->
    <BaseCard v-if="savedBudgets.length > 0" padding="p-0">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('saved_budgets') }}</h2>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="item in savedBudgets"
          :key="item.monthKey"
          class="flex items-center justify-between px-4 py-3.5"
        >
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ item.label }}</p>
            <p class="text-xs text-primary-600 dark:text-primary-400 font-medium mt-0.5">
              <template v-if="item.total > 0">{{ t('monthly_total') }} {{ formatCurrency(item.total) }}<template v-if="item.catCount"> · </template></template>
              <template v-if="item.catCount">{{ item.catCount }} {{ t('category_limits_count') }}</template>
            </p>
          </div>
          <button
            class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            :title="t('delete')"
            :aria-label="t('delete')"
            @click="handleRemove(item.monthKey)"
          >
            <AppIcon :icon="Trash2" size="action" />
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- Empty state -->
    <BaseCard v-else>
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-14 h-14 bg-tertiary-50 dark:bg-tertiary-900/30 rounded-2xl flex items-center justify-center text-tertiary-600 dark:text-tertiary-400 mb-3">
          <AppIcon :icon="Target" size="hero" />
        </div>
        <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ t('no_budgets_title') }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('no_budgets_desc') }}</p>
      </div>
    </BaseCard>

  </div>
</template>
