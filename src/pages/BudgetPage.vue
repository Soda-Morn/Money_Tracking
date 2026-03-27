<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCategories } from '../composables/useCategories'
import { useBudget } from '../composables/useBudget'
import { useFormat } from '../composables/useFormat'
import { useCurrency } from '../composables/useCurrency'
import { useI18n } from 'vue-i18n'
import BaseCard from '../components/ui/BaseCard.vue'

const router = useRouter()
const { expenseCategories } = useCategories()
const { budgets, setBudget, removeBudget } = useBudget()
const { formatCurrency } = useFormat()
const { currency } = useCurrency()
const { t } = useI18n()

const editingCategory = ref(null)
const editingAmount = ref('')
const saving = ref(false)

const openEdit = (cat) => {
  editingCategory.value = cat.value
  editingAmount.value = budgets.value[cat.value] ? String(budgets.value[cat.value]) : ''
}

const cancelEdit = () => { editingCategory.value = null }

const saveEdit = async () => {
  const amount = parseFloat(editingAmount.value)
  if (!isNaN(amount) && amount > 0) {
    saving.value = true
    await setBudget(editingCategory.value, amount)
    saving.value = false
  }
  editingCategory.value = null
}

const handleRemove = async (catValue) => {
  await removeBudget(catValue)
}

// Count how many categories have budgets set
const setBudgetCount = computed(() =>
  expenseCategories.value.filter(c => budgets.value[c.value]).length
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

    <!-- Summary pill -->
    <div v-if="expenseCategories.length > 0" class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {{ setBudgetCount }} / {{ expenseCategories.length }} budgets set
      </span>
    </div>

    <!-- Empty state — no expense categories -->
    <BaseCard v-if="expenseCategories.length === 0">
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <div class="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-4xl mb-4">
          💸
        </div>
        <p class="text-base font-semibold text-gray-900 dark:text-white mb-1">No expense categories yet</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">Add expense categories first, then set budgets for each one.</p>
        <button
          class="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/30"
          @click="router.push('/settings/categories')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Categories
        </button>
      </div>
    </BaseCard>

    <!-- Budget list -->
    <BaseCard v-else padding="p-0">
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="cat in expenseCategories"
          :key="cat.value"
          class="px-4 py-3.5"
        >
          <!-- View row -->
          <div v-if="editingCategory !== cat.value" class="flex items-center gap-3">
            <!-- Icon -->
            <div class="w-10 h-10 bg-gray-50 dark:bg-gray-700/60 rounded-xl flex items-center justify-center text-xl shrink-0">
              {{ cat.icon }}
            </div>

            <!-- Name + amount -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ cat.label }}</p>
              <p
                class="text-xs mt-0.5 font-medium"
                :class="budgets[cat.value]
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'"
              >
                {{ budgets[cat.value] ? formatCurrency(budgets[cat.value]) + ' / month' : t('no_budget_set') }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                v-if="budgets[cat.value]"
                class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                :title="t('delete')"
                @click="handleRemove(cat.value)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                class="px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors"
                :class="budgets[cat.value]
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                  : 'text-white bg-blue-600 hover:bg-blue-700'"
                @click="openEdit(cat)"
              >
                {{ budgets[cat.value] ? t('update') : t('set_budget') }}
              </button>
            </div>
          </div>

          <!-- Inline edit row -->
          <div v-else class="flex items-center gap-2">
            <div class="w-10 h-10 bg-gray-50 dark:bg-gray-700/60 rounded-xl flex items-center justify-center text-xl shrink-0">
              {{ cat.icon }}
            </div>
            <input
              v-model="editingAmount"
              type="number"
              min="0"
              step="any"
              :placeholder="currency === 'KHR' ? '0 ៛' : '0.00'"
              class="flex-1 px-3 py-2 text-sm rounded-xl border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              autofocus
              @keyup.enter="saveEdit"
              @keyup.escape="cancelEdit"
            />
            <button
              class="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shrink-0 disabled:opacity-50"
              :disabled="saving"
              @click="saveEdit"
            >
              {{ saving ? '...' : t('add') }}
            </button>
            <button
              class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors shrink-0"
              @click="cancelEdit"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </BaseCard>

  </div>
</template>
