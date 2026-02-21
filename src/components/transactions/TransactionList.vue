<script setup>
import { computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import TransactionItem from './TransactionItem.vue'
import EmptyState from '../ui/EmptyState.vue'
import BaseCard from '../ui/BaseCard.vue'

const props = defineProps({
  transactions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['edit', 'delete'])

const { formatRelativeDate } = useFormat()

// Group transactions by date
const groupedTransactions = computed(() => {
  const groups = {}
  props.transactions.forEach(t => {
    if (!groups[t.date]) {
      groups[t.date] = []
    }
    groups[t.date].push(t)
  })
  // Sort by date descending
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
})
</script>

<template>
  <div>
    <EmptyState
      v-if="transactions.length === 0"
      title="No transactions yet"
      description="Add your first income or expense to start tracking your money"
      icon="folder"
    />

    <div v-else class="space-y-6">
      <div v-for="group in groupedTransactions" :key="group.date">
        <!-- Date Header -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-500">
            {{ formatRelativeDate(group.date) }}
          </h3>
          <span class="text-xs text-gray-400">
            {{ group.items.length }} transaction{{ group.items.length > 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Transaction Items -->
        <div class="space-y-2">
          <TransactionItem
            v-for="transaction in group.items"
            :key="transaction.id"
            :transaction="transaction"
            @edit="emit('edit', $event)"
            @delete="emit('delete', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
