<script setup>
import { useFormat } from '../../composables/useFormat'
import { useI18n } from 'vue-i18n'
import { WalletCards, TrendingUp, TrendingDown } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'

defineProps({
  totalIncome: {
    type: Number,
    default: 0
  },
  totalExpense: {
    type: Number,
    default: 0
  },
  totalBalance: {
    type: Number,
    default: 0
  }
})

const { formatCurrency } = useFormat()
const { t } = useI18n()
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">

    <!-- Total Balance — full-width on mobile, gradient hero card -->
    <div class="col-span-2 sm:col-span-1 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-600 to-secondary-700 rounded-2xl p-5 shadow-lg shadow-primary-500/25">
      <!-- Decorative blobs -->
      <div class="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

      <div class="relative flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-primary-200 uppercase tracking-wider mb-1.5">{{ t('total_balance') }}</p>
          <p :class="['text-2xl font-bold tracking-tight', totalBalance < 0 ? 'text-red-300' : 'text-white']">
            {{ formatCurrency(totalBalance) }}
          </p>
        </div>
        <div class="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
          <AppIcon :icon="WalletCards" size="card" class="text-white" />
        </div>
      </div>
    </div>

    <!-- Total Income -->
    <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800/80 shadow-sm">
      <div class="absolute top-0 right-0 w-20 h-20 bg-emerald-50 dark:bg-emerald-900/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div class="relative">
        <div class="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-3">
          <AppIcon :icon="TrendingUp" size="card" class="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{{ t('total_income') }}</p>
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
          {{ formatCurrency(totalIncome) }}
        </p>
      </div>
    </div>

    <!-- Total Expense -->
    <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800/80 shadow-sm">
      <div class="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div class="relative">
        <div class="w-9 h-9 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center mb-3">
          <AppIcon :icon="TrendingDown" size="card" class="text-red-500 dark:text-red-400" />
        </div>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{{ t('total_expense') }}</p>
        <p class="text-lg font-bold text-red-500 dark:text-red-400 tracking-tight">
          {{ formatCurrency(totalExpense) }}
        </p>
      </div>
    </div>

  </div>
</template>
