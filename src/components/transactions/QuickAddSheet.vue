<script setup>
/**
 * App-wide "add" sheet (bottom sheet on mobile, dialog on desktop).
 * Opened via useQuickAdd().open(type) from the nav "+" and dashboard actions.
 * Saves through the existing useTransactions() — no new data paths.
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrendingDown, TrendingUp, HandCoins } from 'lucide-vue-next'
import BaseModal from '../ui/BaseModal.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import TransactionForm from './TransactionForm.vue'
import BorrowForm from './BorrowForm.vue'
import { useQuickAdd } from '../../composables/useQuickAdd'
import { useTransactions } from '../../composables/useTransactions'
import { useToast } from '../../composables/useToast'

const { t } = useI18n()
const toast = useToast()
const { isOpen, type, close } = useQuickAdd()
const { addTransaction } = useTransactions()

const saving = ref(false)
// Bumped each time the sheet opens, so forms start fresh instead of showing the last entry
const session = ref(0)
watch(isOpen, (open) => { if (open) session.value++ })

const tabs = computed(() => [
  { value: 'expense', label: t('expense'), icon: TrendingDown, activeClass: 'text-red-500 dark:text-red-400' },
  { value: 'income', label: t('income'), icon: TrendingUp, activeClass: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'lending', label: t('lending_short'), icon: HandCoins, activeClass: 'text-tertiary-600 dark:text-tertiary-300' },
])

const title = computed(() => (type.value === 'lending' ? t('add_borrow_payback') : t('add_transaction')))

const handleSubmit = async (data) => {
  if (saving.value) return
  saving.value = true
  try {
    await addTransaction(data)
    toast.success(t(type.value === 'lending' ? 'toast_record_added' : 'toast_transaction_added'))
    close()
  } catch (e) {
    // Keep the sheet open with the user's input intact so they can retry
    toast.error(t('toast_save_error'))
  } finally {
    saving.value = false
  }
}

const handleClose = () => { if (!saving.value) close() }
</script>

<template>
  <BaseModal :show="isOpen" :title="title" @close="handleClose">
    <div class="space-y-5">
      <SegmentedControl v-model="type" :options="tabs" :label="title" />

      <TransactionForm
        v-if="type !== 'lending'"
        :key="'tx-' + session"
        :initial-data="{ type }"
        :saving="saving"
        hide-type-toggle
        @submit="handleSubmit"
        @cancel="handleClose"
      />
      <BorrowForm
        v-else
        :key="'lend-' + session"
        :initial-data="{ type: 'borrow' }"
        :saving="saving"
        @submit="handleSubmit"
        @cancel="handleClose"
      />
    </div>
  </BaseModal>
</template>
