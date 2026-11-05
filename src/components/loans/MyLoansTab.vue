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
import AppIcon from '../ui/AppIcon.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import { Plus } from 'lucide-vue-next'

const { t } = useI18n()
const { formatCurrency } = useFormat()
const toast = useToast()
const {
  activeLoans, completedLoans, archivedLoans, addLoan, addPayment,
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

// ── Filter: Pending (default) | Completed | All ───────────────────────────────
// Paid-off loans keep their card (marked "Paid off"); loans archived in older
// versions of the app are paid off too, so they show under Completed again.
const filter = ref('pending')
const paidOffLoans = computed(() => [
  ...completedLoans.value,
  ...archivedLoans.value.filter((l) => getRemainingBalance(l) <= 0),
])
const filterOptions = computed(() => [
  { value: 'pending', label: `${t('loan_filter_pending')} · ${activeLoans.value.length}` },
  { value: 'completed', label: `${t('completed')} · ${paidOffLoans.value.length}` },
  { value: 'all', label: t('all') },
])

const sortedActiveLoans = computed(() => {
  const list = filter.value === 'pending' ? [...activeLoans.value]
    : filter.value === 'completed' ? [...paidOffLoans.value]
      : [...activeLoans.value, ...paidOffLoans.value]
  // "All": pending loans first, paid-off ones after them
  if (filter.value === 'all') {
    const done = (l) => (getRemainingBalance(l) <= 0 ? 1 : 0)
    return sortList(list).sort((a, b) => done(a) - done(b))
  }
  return sortList(list)
})

function sortList(list) {
  switch (sortBy.value) {
    case 'remaining_asc':  return list.sort((a, b) => getRemainingBalance(a) - getRemainingBalance(b))
    case 'next_payment':   return list.sort((a, b) => getNextPaymentDate(a) - getNextPaymentDate(b))
    case 'payment_desc':   return list.sort((a, b) => Number(b.expectedMonthlyPayment || 0) - Number(a.expectedMonthlyPayment || 0))
    case 'recent':         return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    default:                return list.sort((a, b) => getRemainingBalance(b) - getRemainingBalance(a)) // remaining_desc
  }
}

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
      class="hidden sm:flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm"
      @click="showAddModal = true"
    >
      <AppIcon :icon="Plus" size="button" />
      {{ t('add_loan') }}
    </button>

    <!-- Loans: filter (Pending by default) + sort -->
    <div class="space-y-3">
      <SegmentedControl v-model="filter" :options="filterOptions" :label="t('loan_filter_label')" />
      <div class="flex items-center justify-between px-0.5">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ filter === 'pending' ? t('active_loans') : filter === 'completed' ? t('completed_loans') : t('loan_filter_all_loans') }}
        </h3>
        <select
          v-model="sortBy"
          :aria-label="t('loan_sort_label')"
          class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ t(opt.label) }}</option>
        </select>
      </div>

      <BaseCard v-if="sortedActiveLoans.length === 0">
        <EmptyState
          v-if="filter === 'completed'"
          :title="t('loan_none_completed_title')"
          :description="t('loan_none_completed_desc')"
          icon="trophy"
        />
        <EmptyState
          v-else-if="filter === 'pending' && paidOffLoans.length"
          :title="t('loan_all_paid_title')"
          :description="t('loan_all_paid_desc')"
          icon="party-popper"
        />
        <EmptyState v-else :title="t('no_loans_title')" :description="t('no_loans_desc')" icon="folder" />
      </BaseCard>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LoanCard v-for="loan in sortedActiveLoans" :key="loan.id" :loan="loan" @make-payment="openPaymentModal" />
      </div>
    </div>

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
