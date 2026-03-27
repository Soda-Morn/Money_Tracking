<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBudget } from '../composables/useBudget'
import { useFormat } from '../composables/useFormat'
import { useCurrency } from '../composables/useCurrency'
import { useI18n } from 'vue-i18n'
import BaseCard from '../components/ui/BaseCard.vue'

const router = useRouter()
const { budgets, setBudget, removeBudget } = useBudget()
const { formatCurrency, getMonthName } = useFormat()
const { currency } = useCurrency()
const { t } = useI18n()

// ── Form state ────────────────────────────────────────────────────────────────
const now = new Date()
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const selectedMonth = ref(currentMonthKey)
const budgetAmount = ref('')
const saving = ref(false)

const handleSave = async () => {
  const amount = parseFloat(budgetAmount.value)
  if (!isNaN(amount) && amount > 0) {
    saving.value = true
    await setBudget(selectedMonth.value, amount)
    saving.value = false
    budgetAmount.value = ''
  }
}

const handleRemove = async (monthKey) => {
  await removeBudget(monthKey)
}

// ── Sorted list of saved budgets ──────────────────────────────────────────────
const savedBudgets = computed(() =>
  Object.entries(budgets.value)
    .sort((a, b) => b[0].localeCompare(a[0])) // newest first
    .map(([monthKey, total]) => {
      const [year, month] = monthKey.split('-').map(Number)
      return { monthKey, total, label: `${getMonthName(month - 1)} ${year}` }
    })
)
</script>

<template>
  <div class="space-y-5 max-w-2xl mx-auto animate-fade-in">

    <!-- Page header -->
    <div class="flex items-center gap-3">
      <button
        class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        @click="router.back()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('monthly_budget') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('budget_desc') }}</p>
      </div>
    </div>

    <!-- Set budget form -->
    <BaseCard>
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Set Total Budget</h2>
      <div class="space-y-3">
        <!-- Month picker -->
        <div>
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Month</label>
          <input
            v-model="selectedMonth"
            type="month"
            class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <!-- Amount input -->
        <div>
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Total Budget Amount</label>
          <input
            v-model="budgetAmount"
            type="number"
            min="0"
            step="any"
            :placeholder="currency === 'KHR' ? '0 ៛' : '0.00'"
            class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleSave"
          />
        </div>
        <button
          class="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
          :disabled="saving || !budgetAmount"
          @click="handleSave"
        >
          {{ saving ? '...' : t('set_budget') }}
        </button>
      </div>
    </BaseCard>

    <!-- Saved budgets list -->
    <BaseCard v-if="savedBudgets.length > 0" padding="p-0">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Saved Budgets</h2>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="item in savedBudgets"
          :key="item.monthKey"
          class="flex items-center justify-between px-4 py-3.5"
        >
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ item.label }}</p>
            <p class="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
              {{ formatCurrency(item.total) }} / month
            </p>
          </div>
          <button
            class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            :title="t('delete')"
            @click="handleRemove(item.monthKey)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- Empty state -->
    <BaseCard v-else>
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-14 h-14 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-3xl mb-3">
          💸
        </div>
        <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">No budgets set yet</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Pick a month and set a total budget above.</p>
      </div>
    </BaseCard>

  </div>
</template>
