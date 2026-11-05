<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import EmptyState from '../ui/EmptyState.vue'
import AppIcon from '../ui/AppIcon.vue'
import { Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  loan: { type: Object, required: true },
  payments: { type: Array, default: () => [] }, // this loan's payments, any order
  readonly: { type: Boolean, default: false }   // paid-off loans: view only
})

const emit = defineEmits(['edit', 'delete'])

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormat()

// Running "remaining balance after this payment" — computed chronologically
// (oldest first) then reversed so the most recent payment shows on top,
// matching the rest of the app's newest-first convention.
const rows = computed(() => {
  const chronological = [...props.payments].sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1))
  let cumulative = 0
  const withRemaining = chronological.map(p => {
    cumulative += Number(p.amount)
    return { ...p, remainingAfter: Math.max(0, Math.round((Number(props.loan.originalAmount) - cumulative) * 100) / 100) }
  })
  return withRemaining.reverse()
})
</script>

<template>
  <EmptyState v-if="rows.length === 0" :title="t('no_payments_yet')" icon="folder" />
  <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
    <div v-for="row in rows" :key="row.id" class="flex items-center justify-between gap-3 py-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDate(row.paymentDate) }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ t('remaining') }}: {{ formatCurrency(row.remainingAfter) }}
          <span v-if="row.paymentMethod"> · {{ row.paymentMethod }}</span>
        </p>
        <p v-if="row.note" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{{ row.note }}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-sm font-semibold text-primary-600 dark:text-primary-400 mr-1">−{{ formatCurrency(row.amount) }}</span>
        <button v-if="!readonly" class="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors" :title="t('update')" :aria-label="t('update')" @click="emit('edit', row)">
          <AppIcon :icon="Pencil" size="action" />
        </button>
        <button v-if="!readonly" class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors" :title="t('delete')" :aria-label="t('delete')" @click="emit('delete', row)">
          <AppIcon :icon="Trash2" size="action" />
        </button>
      </div>
    </div>
  </div>
</template>
