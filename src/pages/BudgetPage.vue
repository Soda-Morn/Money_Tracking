<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBudget } from '../composables/useBudget'
import { useCategories, defaultExpenseCategories } from '../composables/useCategories'
import { useFormat } from '../composables/useFormat'
import { useCurrency } from '../composables/useCurrency'
import { useI18n } from 'vue-i18n'
import BaseCard from '../components/ui/BaseCard.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { ChevronLeft, Trash2, Target } from 'lucide-vue-next'

const router = useRouter()
const { budgets, setCategoryBudget, removeCategoryBudget, removeBudget } = useBudget()
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

// ── Category limit form ───────────────────────────────────────────────────────
const newCategoryValue = ref('')
const newCategoryAmount = ref('')
const savingCategory = ref(false)

const handleAddCategoryLimit = async () => {
  if (!newCategoryValue.value || !newCategoryAmount.value) return
  const amount = parseFloat(newCategoryAmount.value)
  if (isNaN(amount) || amount <= 0) return
  savingCategory.value = true
  await setCategoryBudget(selectedMonth.value, newCategoryValue.value, amount)
  savingCategory.value = false
  newCategoryValue.value = ''
  newCategoryAmount.value = ''
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
      return { monthKey, catCount, label: `${getMonthName(month - 1)} ${year}` }
    })
    .filter(item => item.catCount > 0) // only show months that have category limits
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
        class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
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

        <div v-if="availableCategories.length > 0" class="flex gap-2">
          <select
            v-model="newCategoryValue"
            class="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{{ t('select_category') }}</option>
            <option v-for="cat in availableCategories" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
          <input
            v-model="newCategoryAmount"
            type="number"
            min="0"
            step="any"
            :placeholder="currency === 'KHR' ? '0 ៛' : '0.00'"
            class="w-28 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            @keyup.enter="handleAddCategoryLimit"
          />
          <button
            class="px-3 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
            :disabled="savingCategory || !newCategoryValue || !newCategoryAmount"
            @click="handleAddCategoryLimit"
          >
            {{ savingCategory ? '...' : t('add') }}
          </button>
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
              {{ item.catCount }} {{ t('category_limits_count') }}
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
