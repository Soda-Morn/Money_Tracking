<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../composables/useFormat'
import { useLoans } from '../composables/useLoans'
import { useToast } from '../composables/useToast'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import LoanForm from '../components/loans/LoanForm.vue'
import LoanPaymentForm from '../components/loans/LoanPaymentForm.vue'
import PaymentHistoryList from '../components/loans/PaymentHistoryList.vue'
import RepaymentScheduleTable from '../components/loans/RepaymentScheduleTable.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatCurrency, formatDate } = useFormat()
const toast = useToast()
const {
  loans, updateLoan, deleteLoan, addPayment, updatePayment, deletePayment,
  getPaymentsForLoan, getTotalPaid, getRemainingBalance, getProgressPct,
  getRemainingPayments, getFinalPaymentAmount, getNextPaymentDate,
  getEstimatedPayoffDate, getRepaymentSchedule, isLoanPaidOff
} = useLoans()

const loan = computed(() => loans.value.find(l => l.id === route.params.id))
const payments = computed(() => loan.value ? getPaymentsForLoan(loan.value.id) : [])

const totalPaid = computed(() => loan.value ? getTotalPaid(loan.value.id) : 0)
const remaining = computed(() => loan.value ? getRemainingBalance(loan.value) : 0)
const progressPct = computed(() => loan.value ? getProgressPct(loan.value) : 0)
const progressLabel = computed(() => Number.isInteger(progressPct.value) ? `${progressPct.value}%` : `${progressPct.value.toFixed(2)}%`)
const remainingPayments = computed(() => loan.value ? getRemainingPayments(loan.value) : null)
const finalPayment = computed(() => loan.value ? getFinalPaymentAmount(loan.value) : null)
const nextPaymentDate = computed(() => loan.value && !isPaidOff.value ? getNextPaymentDate(loan.value) : null)
const payoffDate = computed(() => loan.value ? getEstimatedPayoffDate(loan.value) : null)
const schedule = computed(() => loan.value ? getRepaymentSchedule(loan.value) : [])
const isPaidOff = computed(() => loan.value ? isLoanPaidOff(loan.value) : false)

const daysUntilNextPayment = computed(() => {
  if (!nextPaymentDate.value) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((nextPaymentDate.value - today) / 86400000)
})

// Primary insight — mirrors the mockup's "At your current $X/month payment..." tip
const insight = computed(() => {
  if (!loan.value) return ''
  if (isPaidOff.value) return t('insight_paid_off')
  if (remainingPayments.value === null) return t('set_monthly_payment_hint')
  return t('insight_current_pace', {
    amount: formatCurrency(loan.value.expectedMonthlyPayment),
    n: remainingPayments.value
  })
})

// ── Edit Loan ──────────────────────────────────────────────────────────────────
const showEditModal = ref(false)
const handleEditLoan = async (data) => {
  try {
    await updateLoan(loan.value.id, data)
    showEditModal.value = false
    toast.success(t('toast_loan_updated'))
  } catch (e) {
    console.error('[loans] updateLoan failed:', e)
    toast.error(t('toast_loan_error'))
  }
}

// ── Delete Loan ────────────────────────────────────────────────────────────────
const showDeleteLoanDialog = ref(false)
const confirmDeleteLoan = async () => {
  try {
    await deleteLoan(loan.value.id)
    showDeleteLoanDialog.value = false
    toast.success(t('toast_loan_deleted'))
    router.push('/loans')
  } catch (e) {
    console.error('[loans] deleteLoan failed:', e)
    toast.error(t('toast_loan_error'))
  }
}

// ── Make / Edit Payment ────────────────────────────────────────────────────────
const showPaymentModal = ref(false)
const editingPayment = ref(null)

const openMakePayment = () => {
  editingPayment.value = null
  showPaymentModal.value = true
}
const openEditPayment = (payment) => {
  editingPayment.value = payment
  showPaymentModal.value = true
}
const handlePaymentSubmit = async (data) => {
  try {
    if (editingPayment.value) {
      await updatePayment(editingPayment.value.id, data)
      toast.success(t('toast_payment_updated'))
    } else {
      await addPayment(loan.value.id, data)
      toast.success(t('toast_payment_recorded', { amount: formatCurrency(data.amount) }))
    }
    showPaymentModal.value = false
    editingPayment.value = null
  } catch (e) {
    console.error('[loans] payment submit failed:', e)
    toast.error(t('toast_payment_error'))
  }
}

// ── Delete Payment ─────────────────────────────────────────────────────────────
const showDeletePaymentDialog = ref(false)
const deletingPayment = ref(null)
const requestDeletePayment = (payment) => {
  deletingPayment.value = payment
  showDeletePaymentDialog.value = true
}
const confirmDeletePayment = async () => {
  try {
    if (deletingPayment.value) {
      await deletePayment(deletingPayment.value.id)
      toast.success(t('toast_payment_deleted'))
    }
    showDeletePaymentDialog.value = false
    deletingPayment.value = null
  } catch (e) {
    console.error('[loans] deletePayment failed:', e)
    toast.error(t('toast_payment_error'))
  }
}
</script>

<template>
  <div class="space-y-5 max-w-2xl mx-auto animate-fade-in">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <button class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
        {{ loan ? t('loan_from', { name: loan.lenderName }) : '' }}
      </h1>
    </div>

    <template v-if="loan">
      <!-- Paid off banner -->
      <div v-if="isPaidOff" class="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 text-center text-white shadow-lg">
        <p class="text-3xl mb-1">🎉</p>
        <p class="text-lg font-bold">{{ t('loan_paid_off_title') }}</p>
        <p class="text-sm text-green-100 mt-1">{{ t('loan_paid_off_desc') }}</p>
      </div>

      <!-- Main stats -->
      <BaseCard>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{{ t('remaining_balance') }}</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white mb-1">{{ formatCurrency(remaining) }}</p>
        <p v-if="!isPaidOff && nextPaymentDate" class="text-xs text-amber-600 dark:text-amber-400 mb-3">
          🟡 {{ t('next_payment_due', { amount: formatCurrency(loan.expectedMonthlyPayment), date: formatDate(nextPaymentDate.toISOString().slice(0, 10)) }) }}
        </p>

        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5 mt-3">
          <span>{{ t('repayment_progress') }}</span>
          <span class="font-bold text-primary-600 dark:text-primary-400">{{ progressLabel }}</span>
        </div>
        <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-3">
          <div class="h-full rounded-full bg-primary-600 transition-all duration-500" :style="{ width: Math.min(100, progressPct) + '%' }" />
        </div>

        <div class="flex items-center justify-between text-sm mb-4">
          <span class="text-gray-500 dark:text-gray-400">{{ t('paid') }} <strong class="text-gray-900 dark:text-white">{{ formatCurrency(totalPaid) }}</strong></span>
          <span class="text-gray-500 dark:text-gray-400">{{ t('total') }} <strong class="text-gray-900 dark:text-white">{{ formatCurrency(loan.originalAmount) }}</strong></span>
        </div>

        <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-sm">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('original_amount') }}</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(loan.originalAmount) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('expected_monthly_payment') }}</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ loan.expectedMonthlyPayment ? formatCurrency(loan.expectedMonthlyPayment) : '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('estimated_remaining') }}</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ remainingPayments === null ? '—' : t('n_months', { n: remainingPayments }) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('estimated_payoff') }}</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ payoffDate ? payoffDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—' }}</p>
          </div>
        </div>

        <div class="flex gap-3 mt-4">
          <BaseButton v-if="!isPaidOff" full-width @click="openMakePayment">{{ t('make_payment') }}</BaseButton>
          <BaseButton variant="secondary" full-width @click="showEditModal = true">{{ t('edit_loan') }}</BaseButton>
        </div>
      </BaseCard>

      <!-- Insight -->
      <div class="flex items-start gap-2.5 p-3.5 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
        <span class="text-lg leading-none">💡</span>
        <p class="text-sm text-primary-800 dark:text-primary-300">{{ insight }}</p>
      </div>
      <div v-if="!isPaidOff && daysUntilNextPayment !== null" class="flex items-start gap-2.5 -mt-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700/40">
        <span class="text-lg leading-none">💡</span>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <template v-if="daysUntilNextPayment >= 0">{{ t('insight_days_until_payment', { n: daysUntilNextPayment }) }}</template>
          <template v-else>{{ t('insight_payment_overdue', { n: Math.abs(daysUntilNextPayment) }) }}</template>
        </p>
      </div>

      <!-- Payment History -->
      <BaseCard>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">{{ t('payment_history') }}</h2>
        <PaymentHistoryList :loan="loan" :payments="payments" @edit="openEditPayment" @delete="requestDeletePayment" />
      </BaseCard>

      <!-- Repayment Schedule -->
      <BaseCard v-if="!isPaidOff && schedule.length > 0">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">{{ t('repayment_schedule') }}</h2>
        <RepaymentScheduleTable :schedule="schedule" />
      </BaseCard>

      <!-- Delete Loan -->
      <button
        class="w-full py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
        @click="showDeleteLoanDialog = true"
      >
        {{ t('delete_loan') }}
      </button>

      <!-- Edit Loan Modal -->
      <BaseModal :show="showEditModal" :title="t('edit_loan')" @close="showEditModal = false">
        <LoanForm :initial-data="loan" :is-editing="true" @submit="handleEditLoan" @cancel="showEditModal = false" />
      </BaseModal>

      <!-- Make/Edit Payment Modal -->
      <BaseModal :show="showPaymentModal" :title="editingPayment ? t('edit_payment') : t('record_loan_payment')" @close="showPaymentModal = false">
        <LoanPaymentForm
          :loan="loan"
          :initial-data="editingPayment || {}"
          :is-editing="!!editingPayment"
          @submit="handlePaymentSubmit"
          @cancel="showPaymentModal = false"
        />
      </BaseModal>

      <!-- Delete Loan confirm -->
      <BaseModal :show="showDeleteLoanDialog" :title="t('delete_loan')" @close="showDeleteLoanDialog = false">
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('delete_loan_confirm_desc') }}</p>
          <div class="flex gap-3">
            <BaseButton variant="secondary" full-width @click="showDeleteLoanDialog = false">{{ t('cancel') }}</BaseButton>
            <BaseButton variant="danger" full-width @click="confirmDeleteLoan">{{ t('delete') }}</BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Delete Payment confirm -->
      <BaseModal :show="showDeletePaymentDialog" :title="t('delete_payment')" @close="showDeletePaymentDialog = false">
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('delete_payment_confirm_desc') }}</p>
          <div class="flex gap-3">
            <BaseButton variant="secondary" full-width @click="showDeletePaymentDialog = false">{{ t('cancel') }}</BaseButton>
            <BaseButton variant="danger" full-width @click="confirmDeletePayment">{{ t('delete') }}</BaseButton>
          </div>
        </div>
      </BaseModal>
    </template>

    <BaseCard v-else>
      <p class="text-center text-gray-500 dark:text-gray-400 py-8">{{ t('loan_not_found') }}</p>
    </BaseCard>
  </div>
</template>
