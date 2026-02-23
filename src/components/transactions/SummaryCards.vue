<script setup>
import { useFormat } from '../../composables/useFormat'
import BaseCard from '../ui/BaseCard.vue'

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
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
    <!-- Total Balance -->
    <BaseCard class="relative overflow-hidden">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 mb-1">Total Balance</p>
          <p :class="['text-2xl font-bold', totalBalance >= 0 ? 'text-gray-900' : 'text-red-600']">
            {{ formatCurrency(totalBalance) }}
          </p>
        </div>
        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <div class="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
    </BaseCard>

    <!-- Total Income -->
    <BaseCard class="relative overflow-hidden">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 mb-1">Total Income</p>
          <p class="text-2xl font-bold text-green-600">
            {{ formatCurrency(totalIncome) }}
          </p>
        </div>
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        </div>
      </div>
      <div class="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
    </BaseCard>

    <!-- Total Expense -->
    <BaseCard class="relative overflow-hidden">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 mb-1">Total Expense</p>
          <p class="text-2xl font-bold text-red-600">
            {{ formatCurrency(totalExpense) }}
          </p>
        </div>
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
        </div>
      </div>
      <div class="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
    </BaseCard>
  </div>
</template>
