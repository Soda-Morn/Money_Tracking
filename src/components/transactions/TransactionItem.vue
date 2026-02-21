<script setup>
import { useFormat } from '../../composables/useFormat'

defineProps({
  transaction: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete'])

const { formatCurrency } = useFormat()

const categoryIcons = {
  // Expense
  food: '🍔',
  transport: '🚗',
  shopping: '🛍️',
  bills: '📄',
  entertainment: '🎬',
  health: '🏥',
  education: '📚',
  // Income
  salary: '💼',
  freelance: '💻',
  investment: '📈',
  gift: '🎁',
  other: '📌'
}

const categoryLabels = {
  food: 'Food & Dining',
  transport: 'Transportation',
  shopping: 'Shopping',
  bills: 'Bills & Utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  education: 'Education',
  salary: 'Salary',
  freelance: 'Freelance',
  investment: 'Investment',
  gift: 'Gift',
  other: 'Other'
}
</script>

<template>
  <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group">
    <div class="flex items-center space-x-3">
      <!-- Category Icon -->
      <div :class="[
        'w-10 h-10 rounded-full flex items-center justify-center text-lg',
        transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
      ]">
        {{ categoryIcons[transaction.category] || '📌' }}
      </div>

      <!-- Details -->
      <div>
        <p class="font-medium text-gray-900">
          {{ categoryLabels[transaction.category] || transaction.category }}
        </p>
        <p v-if="transaction.description" class="text-sm text-gray-500 truncate max-w-[150px] md:max-w-[250px]">
          {{ transaction.description }}
        </p>
      </div>
    </div>

    <!-- Amount & Actions -->
    <div class="flex items-center space-x-3">
      <span :class="[
        'font-semibold',
        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
      ]">
        {{ transaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
      </span>

      <!-- Actions (visible on hover) -->
      <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          @click="emit('edit', transaction)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          @click="emit('delete', transaction.id)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
