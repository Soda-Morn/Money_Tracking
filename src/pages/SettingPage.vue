<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import { useCurrency, USD_TO_KHR } from '../composables/useCurrency'
import { useBudget } from '../composables/useBudget'
import { defaultExpenseCategories } from '../composables/useCategories'
import { useFormat } from '../composables/useFormat'
import BaseCard from '../components/ui/BaseCard.vue'

const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const { locale } = useLanguage()
const { currency } = useCurrency()
const { budgets, setBudget, removeBudget } = useBudget()
const { formatCurrency } = useFormat()

const formatBudget = (amount) => formatCurrency(amount)

// Budget inline editing
const editingBudgetCategory = ref(null)
const editingBudgetAmount = ref('')

const openBudgetEdit = (cat) => {
  editingBudgetCategory.value = cat.value
  editingBudgetAmount.value = budgets.value[cat.value] ? String(budgets.value[cat.value]) : ''
}

const saveBudget = async () => {
  const amount = parseFloat(editingBudgetAmount.value)
  if (!isNaN(amount) && amount > 0) {
    await setBudget(editingBudgetCategory.value, amount)
  }
  editingBudgetCategory.value = null
}

const cancelBudgetEdit = () => { editingBudgetCategory.value = null }

const menuItems = computed(() => [
  {
    icon: '🏷️',
    label: t('categories'),
    description: t('categories_desc'),
    route: '/settings/categories'
  }
])
</script>

<template>
  <div class="space-y-6 max-w-2xl mx-auto animate-fade-in">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('manage_preferences') }}</p>
    </div>

    <!-- ── Appearance ────────────────────────────────────────────────── -->
    <BaseCard>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('appearance') }}</h2>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center"
            :class="isDark ? 'bg-gray-700' : 'bg-amber-100'"
          >
            <span class="text-xl">{{ isDark ? '🌙' : '☀️' }}</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ isDark ? t('dark_mode') : t('light_mode') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('toggle_dark_mode_desc') }}</p>
          </div>
        </div>

        <!-- iOS-style toggle -->
        <button
          class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          :class="isDark ? 'bg-blue-600' : 'bg-gray-300'"
          aria-label="Toggle dark mode"
          @click="toggleTheme"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
            :class="isDark ? 'translate-x-6' : 'translate-x-1'"
          ></span>
        </button>
      </div>
    </BaseCard>

    <!-- ── General ────────────────────────────────────────────────────── -->
    <BaseCard padding="p-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white px-4 pt-4 pb-3">{{ t('general') }}</h2>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <!-- language selector -->
        <div class="w-full flex items-center justify-between px-4 py-4 text-left">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              🌐
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('language') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('choose_language_desc') }}</p>
            </div>
          </div>
          <select
            v-model="locale"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="en">{{ t('english') }}</option>
            <option value="km">{{ t('khmer') }}</option>
          </select>
        </div>

        <!-- currency selector -->
        <div class="w-full flex items-center justify-between px-4 py-4 text-left">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              💵
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('currency') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('choose_currency_desc') }}
                <span v-if="currency === 'KHR'" class="ml-1 text-blue-500">1 USD = {{ USD_TO_KHR.toLocaleString() }} ៛</span>
              </p>
            </div>
          </div>
          <select
            v-model="currency"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USD">{{ t('usd') }}</option>
            <option value="KHR">{{ t('khr') }}</option>
          </select>
        </div>

        <button
          v-for="item in menuItems"
          :key="item.route"
          class="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          @click="router.push(item.route)"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              {{ item.icon }}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.label }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ item.description }}</p>
            </div>
          </div>
          <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </BaseCard>

    <!-- ── Monthly Budget ──────────────────────────────────────────────────── -->
    <BaseCard padding="p-0">
      <div class="px-4 pt-4 pb-3">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('monthly_budget') }}</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('budget_desc') }}</p>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="cat in defaultExpenseCategories"
          :key="cat.value"
          class="px-4 py-3"
        >
          <!-- View row -->
          <div v-if="editingBudgetCategory !== cat.value" class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-xl w-8 text-center">{{ cat.icon }}</span>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ cat.label }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ budgets[cat.value] ? formatBudget(budgets[cat.value]) : t('no_budget_set') }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="budgets[cat.value]"
                class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                @click="removeBudget(cat.value)"
              >{{ t('delete') }}</button>
              <button
                class="text-xs text-blue-600 dark:text-blue-400 font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                @click="openBudgetEdit(cat)"
              >{{ budgets[cat.value] ? t('update') : t('set_budget') }}</button>
            </div>
          </div>

          <!-- Inline edit row -->
          <div v-else class="flex items-center gap-2">
            <span class="text-xl w-8 text-center shrink-0">{{ cat.icon }}</span>
            <input
              v-model="editingBudgetAmount"
              type="number"
              min="0"
              :placeholder="currency === 'KHR' ? '0 ៛' : '0.00'"
              class="flex-1 px-3 py-1.5 text-sm rounded-xl border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autofocus
              @keyup.enter="saveBudget"
              @keyup.escape="cancelBudgetEdit"
            />
            <button
              class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              @click="saveBudget"
            >{{ t('add') }}</button>
            <button
              class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              @click="cancelBudgetEdit"
            >✕</button>
          </div>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
