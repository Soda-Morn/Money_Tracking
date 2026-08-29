<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useLoans } from '../../composables/useLoans'
import { useToast } from '../../composables/useToast'
import BaseCard from '../ui/BaseCard.vue'
import BaseModal from '../ui/BaseModal.vue'
import EmptyState from '../ui/EmptyState.vue'
import MobileFAB from '../ui/MobileFAB.vue'
import LoanCard from './LoanCard.vue'
import LoanForm from './LoanForm.vue'
import LoanPaymentForm from './LoanPaymentForm.vue'

const { t } = useI18n()
const { formatCurrency } = useFormat()
const toast = useToast()
const {
  activeLoans, completedLoans, addLoan, addPayment, archiveLoan,
  getRemainingBalance, getNextPaymentDate, getEstimatedPayoffDate,
  totalOriginalDebt, totalPaidAll, totalRemainingAll, activeLoanCount, totalMonthlyPayments
} = useLoans()

// ── Sorting ────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'remaining_desc', label: 'sort_highest_remaining' },
  { value: 'remaining_asc',  label: 'sort_lowest_remaining' },
  { value: 'next_payment',   label: 'sort_next_payment' },
  { value: 'payment_desc',   label: 'sort_highest_payment' },
  { value: 'recent',         label: 'sort_recently_updated' },
]
const sortBy = ref('remaining_desc')

const sortedActiveLoans = computed(() => {
  const list = [...activeLoans.value]
  switch (sortBy.value) {
    case 'remaining_asc':  return list.sort((a, b) => getRemainingBalance(a) - getRemainingBalance(b))
    case 'next_payment':   return list.sort((a, b) => getNextPaymentDate(a) - getNextPaymentDate(b))
    case 'payment_desc':   return list.sort((a, b) => Number(b.expectedMonthlyPayment || 0) - Number(a.expectedMonthlyPayment || 0))
    case 'recent':         return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    default:                return list.sort((a, b) => getRemainingBalance(b) - getRemainingBalance(a)) // remaining_desc
  }
})

// ── Add Loan ─────────────────────────────────────────────────────────────────
const showAddModal = ref(false)
const handleAddLoan = async (data) => {
  try {
    await addLoan(data)
    showAddModal.value = false
    toast.success(t('toast_loan_added'))
  } catch (e) {
    console.error('[loans] addLoan failed:', e)
    toast.error(t('toast_loan_error'))
  }
}

// ── Make Payment ───────────────────────────────────────────────────────────────
const showPaymentModal = ref(false)
const payingLoan = ref(null)

const openPaymentModal = (loan) => {
  payingLoan.value = loan
  showPaymentModal.value = true
}

const handlePaymentSubmit = async (data) => {
  try {
    await addPayment(payingLoan.value.id, data)
    showPaymentModal.value = false
    toast.success(t('toast_payment_recorded', { amount: formatCurrency(data.amount) }))
    payingLoan.value = null
  } catch (e) {
    console.error('[loans] addPayment failed:', e)
    toast.error(t('toast_payment_error'))
  }
}

// ── Completed loans ────────────────────────────────────────────────────────────
const showCompleted = ref(false)
const handleArchive = async (id) => {
  try {
    await archiveLoan(id, true)
    toast.success(t('toast_loan_archived'))
  } catch (e) {
    console.error('[loans] archiveLoan failed:', e)
    toast.error(t('toast_loan_error'))
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="relative overflow-hidden bg-gradient-to-br from-primary-800 to-primary-950 rounded-2xl p-4 shadow-lg shadow-primary-900/20">
        <div class="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
        <p class="text-xs font-semibold text-primary-200 uppercase tracking-wide mb-1">{{ t('total_remaining') }}</p>
        <p class="text-xl font-bold text-white">{{ formatCurrency(totalRemainingAll) }}</p>
        <p class="text-[11px] text-primary-200 mt-1">{{ t('total_original') }}: {{ formatCurrency(totalOriginalDebt) }}</p>
      </div>
      <BaseCard>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{{ t('total_paid') }}</p>
        <p class="text-xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(totalPaidAll) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{{ t('active_loans') }}</p>
        <p class="text-xl font-bold text-gray-900 dark:text-white">{{ activeLoanCount }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{{ t('monthly_payments') }}</p>
        <p class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalMonthlyPayments) }}</p>
      </BaseCard>
    </div>

    <!-- Add Loan (desktop) -->
    <button
      class="hidden sm:block w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm"
      @click="showAddModal = true"
    >
      + {{ t('add_loan') }}
    </button>

    <!-- Active Loans -->
    <div>
      <div class="flex items-center justify-between mb-2 px-0.5">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('active_loans') }}</h3>
        <select
          v-model="sortBy"
          class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ t(opt.label) }}</option>
        </select>
      </div>

      <BaseCard v-if="sortedActiveLoans.length === 0">
        <EmptyState :title="t('no_loans_title')" :description="t('no_loans_desc')" icon="folder" />
      </BaseCard>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LoanCard v-for="loan in sortedActiveLoans" :key="loan.id" :loan="loan" @make-payment="openPaymentModal" />
      </div>
    </div>

    <!-- Completed Loans -->
    <BaseCard v-if="completedLoans.length > 0" padding="p-0">
      <button class="w-full flex items-center justify-between px-4 py-3 text-left" @click="showCompleted = !showCompleted">
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('completed_loans') }} ({{ completedLoans.length }})</span>
        <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="showCompleted ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="showCompleted" class="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
        <div v-for="loan in completedLoans" :key="loan.id" class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">🎉</span>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('loan_from', { name: loan.lenderName }) }}</p>
              <p class="text-xs text-green-600 dark:text-green-400">{{ t('paid_off') }}</p>
            </div>
          </div>
          <button class="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" @click="handleArchive(loan.id)">
            {{ t('archive') }}
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- Add Loan Modal -->
    <BaseModal :show="showAddModal" :title="t('add_loan')" @close="showAddModal = false">
      <LoanForm @submit="handleAddLoan" @cancel="showAddModal = false" />
    </BaseModal>

    <!-- Make Payment Modal -->
    <BaseModal :show="showPaymentModal" :title="t('record_loan_payment')" @close="showPaymentModal = false">
      <LoanPaymentForm v-if="payingLoan" :loan="payingLoan" @submit="handlePaymentSubmit" @cancel="showPaymentModal = false" />
    </BaseModal>

    <!-- Mobile FAB -->
    <MobileFAB @click="showAddModal = true" />
  </div>
</template>
