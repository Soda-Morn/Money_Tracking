<script setup>
import { computed } from 'vue'
import { useFormat, sortByDateDesc } from '../../composables/useFormat'
import { useI18n } from 'vue-i18n'
import BaseModal from '../ui/BaseModal.vue'
import EmptyState from '../ui/EmptyState.vue'
import AppIcon from '../ui/AppIcon.vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  show: { type: Boolean, default: false },
  personName: { type: String, default: '' },
  transactions: { type: Array, default: () => [] } // pre-filtered: this person's borrow+payback rows
})

const emit = defineEmits(['close', 'edit', 'delete', 'addRecord'])

const { formatCurrency, formatDate } = useFormat()
const { t } = useI18n()

const sorted = computed(() => [...props.transactions].sort(sortByDateDesc))

const totals = computed(() => {
  const borrowed = props.transactions.filter(t => t.type === 'borrow').reduce((s, t) => s + Number(t.amount), 0)
  const paid = props.transactions.filter(t => t.type === 'payback').reduce((s, t) => s + Number(t.amount), 0)
  return { borrowed, paid, net: borrowed - paid }
})
</script>

<template>
  <BaseModal :show="show" :title="personName" @close="emit('close')">
    <!-- Net summary -->
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-2.5 text-center">
        <p class="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide mb-0.5">{{ t('total_borrowed') }}</p>
        <p class="text-sm font-bold text-green-700 dark:text-green-400">{{ formatCurrency(totals.borrowed) }}</p>
      </div>
      <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-2.5 text-center">
        <p class="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase tracking-wide mb-0.5">{{ t('total_paid_back') }}</p>
        <p class="text-sm font-bold text-red-700 dark:text-red-400">{{ formatCurrency(totals.paid) }}</p>
      </div>
      <div class="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-2.5 text-center">
        <p class="text-[10px] font-medium text-primary-700 dark:text-primary-400 uppercase tracking-wide mb-0.5">{{ t('net_balance') }}</p>
        <p class="text-sm font-bold text-primary-700 dark:text-primary-400">{{ formatCurrency(Math.abs(totals.net)) }}</p>
      </div>
    </div>

    <!-- Add record for this person -->
    <button
      class="w-full mb-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
      @click="emit('addRecord', personName)"
    >
      <AppIcon :icon="Plus" size="button" />
      {{ t('add_borrow_payback') }}
    </button>

    <!-- Ledger -->
    <EmptyState v-if="sorted.length === 0" :title="t('no_transactions_title')" icon="folder" />
    <div v-else class="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
      <div
        v-for="tx in sorted"
        :key="tx.id"
        class="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span
              :class="[
                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                tx.type === 'borrow'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
              ]"
            >{{ tx.type === 'borrow' ? t('borrow') : t('payback') }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(tx.date) }}</span>
          </div>
          <p v-if="tx.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{{ tx.description }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="text-sm font-semibold whitespace-nowrap"
            :class="tx.type === 'borrow' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >{{ formatCurrency(tx.amount) }}</span>
          <button class="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors" :title="t('update')" @click="emit('edit', tx)">
            <AppIcon :icon="Pencil" size="action" />
          </button>
          <button class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors" :title="t('delete')" @click="emit('delete', tx.id, tx.name)">
            <AppIcon :icon="Trash2" size="action" />
          </button>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
