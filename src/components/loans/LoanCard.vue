<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useLoans } from '../../composables/useLoans'

const props = defineProps({
  loan: { type: Object, required: true }
})

const emit = defineEmits(['makePayment'])

const router = useRouter()
const { t } = useI18n()
const { formatCurrency } = useFormat()
const {
  getTotalPaid, getRemainingBalance, getProgressPct,
  getRemainingPayments, getEstimatedPayoffDate, getPaymentStatus
} = useLoans()

const totalPaid = computed(() => getTotalPaid(props.loan.id))
const remaining = computed(() => getRemainingBalance(props.loan))
const progressPct = computed(() => getProgressPct(props.loan))
const progressLabel = computed(() => {
  const p = progressPct.value
  return Number.isInteger(p) ? `${p}%` : `${p.toFixed(2)}%`
})
const remainingPayments = computed(() => getRemainingPayments(props.loan))
const payoffDate = computed(() => getEstimatedPayoffDate(props.loan))
const payoffLabel = computed(() => {
  if (!payoffDate.value) return t('set_monthly_payment_hint')
  return payoffDate.value.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
})
const status = computed(() => getPaymentStatus(props.loan))
const isPaidOff = computed(() => remaining.value <= 0)

const viewDetails = () => router.push(`/loans/${props.loan.id}`)
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="p-4 border-b border-gray-100 dark:border-gray-700">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 shrink-0 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-base">
            💳
          </div>
          <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ t('loan_from', { name: loan.lenderName }) }}</h3>
        </div>
        <span
          v-if="isPaidOff"
          class="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full"
        >{{ t('paid_off') }}</span>
        <span
          v-else-if="status === 'overdue'"
          class="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full"
        >🔴 {{ t('overdue') }}</span>
        <span
          v-else
          class="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full"
        >🟡 {{ t('upcoming') }}</span>
      </div>
    </div>

    <!-- Body -->
    <div class="p-4 space-y-3">
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('remaining_debt') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(remaining) }}</p>
      </div>

      <div>
        <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            class="h-full rounded-full bg-primary-600 transition-all duration-500"
            :style="{ width: Math.min(100, progressPct) + '%' }"
          />
        </div>
        <p class="text-xs text-primary-600 dark:text-primary-400 font-semibold mt-1">{{ progressLabel }} {{ t('paid_label') }}</p>
      </div>

      <div class="flex items-center justify-between text-sm">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('paid') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(totalPaid) }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('original') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(loan.originalAmount) }}</p>
        </div>
      </div>

      <div v-if="!isPaidOff" class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-sm">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('monthly_payment') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ loan.expectedMonthlyPayment ? formatCurrency(loan.expectedMonthlyPayment) : '—' }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('estimated_remaining') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">
            {{ remainingPayments === null ? '—' : t('n_months', { n: remainingPayments }) }}
          </p>
        </div>
      </div>
      <p v-if="!isPaidOff" class="text-xs text-gray-400 dark:text-gray-500 -mt-1">
        {{ t('estimated_payoff') }}: {{ payoffLabel }}
      </p>
    </div>

    <!-- Actions -->
    <div class="grid grid-cols-2 gap-2 p-3 pt-0">
      <button
        v-if="!isPaidOff"
        class="py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        @click="emit('makePayment', loan)"
      >
        {{ t('make_payment') }}
      </button>
      <button
        :class="[
          'py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
          isPaidOff ? 'col-span-2' : ''
        ]"
        @click="viewDetails"
      >
        {{ t('view_details') }}
      </button>
    </div>
  </div>
</template>
