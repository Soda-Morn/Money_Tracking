<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useCurrency } from '../../composables/useCurrency'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

const props = defineProps({
  initialData: { type: Object, default: () => ({}) },
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()
const { getCurrentDate } = useFormat()
const { currency: appCurrency } = useCurrency()

const form = ref({
  lenderName: props.initialData.lenderName || '',
  originalAmount: props.initialData.originalAmount != null ? String(props.initialData.originalAmount) : '',
  currency: props.initialData.currency || appCurrency.value,
  startDate: props.initialData.startDate || getCurrentDate(),
  expectedMonthlyPayment: props.initialData.expectedMonthlyPayment != null ? String(props.initialData.expectedMonthlyPayment) : '',
  paymentFrequency: props.initialData.paymentFrequency || 'monthly',
  customIntervalDays: props.initialData.customIntervalDays != null ? String(props.initialData.customIntervalDays) : '30',
  firstPaymentDate: props.initialData.firstPaymentDate || props.initialData.startDate || getCurrentDate(),
  hasInterest: (props.initialData.interestType || 'none') !== 'none',
  interestRate: props.initialData.interestRate != null ? String(props.initialData.interestRate) : '',
  notes: props.initialData.notes || '',
})

const FREQUENCIES = [
  { value: 'monthly',  label: 'frequency_monthly' },
  { value: 'weekly',   label: 'frequency_weekly' },
  { value: 'biweekly', label: 'frequency_biweekly' },
  { value: 'custom',   label: 'frequency_custom' },
]

const isValid = computed(() =>
  form.value.lenderName.trim().length > 0 &&
  form.value.originalAmount > 0 &&
  form.value.startDate &&
  form.value.expectedMonthlyPayment > 0 &&
  form.value.firstPaymentDate &&
  (form.value.paymentFrequency !== 'custom' || form.value.customIntervalDays > 0)
)

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    lenderName: form.value.lenderName.trim(),
    originalAmount: Number(form.value.originalAmount),
    currency: form.value.currency,
    startDate: form.value.startDate,
    expectedMonthlyPayment: Number(form.value.expectedMonthlyPayment),
    paymentFrequency: form.value.paymentFrequency,
    customIntervalDays: form.value.paymentFrequency === 'custom' ? Number(form.value.customIntervalDays) : null,
    firstPaymentDate: form.value.firstPaymentDate,
    interestType: form.value.hasInterest ? 'percentage' : 'none',
    interestRate: form.value.hasInterest ? Number(form.value.interestRate || 0) : 0,
    notes: form.value.notes,
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <BaseInput v-model="form.lenderName" :label="t('lender_name')" :placeholder="t('lender_name_placeholder')" :required="true" />

    <div class="grid grid-cols-2 gap-3">
      <BaseInput v-model="form.originalAmount" type="number" :label="t('original_amount')" placeholder="0.00" :required="true" />
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('currency') }}</label>
        <select
          v-model="form.currency"
          class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="USD">{{ t('usd') }}</option>
          <option value="KHR">{{ t('khr') }}</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <BaseInput v-model="form.startDate" type="date" :label="t('loan_start_date')" :required="true" />
      <BaseInput v-model="form.firstPaymentDate" type="date" :label="t('first_payment_date')" :required="true" />
    </div>

    <BaseInput v-model="form.expectedMonthlyPayment" type="number" :label="t('expected_monthly_payment')" placeholder="0.00" :required="true" />

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('payment_frequency') }}</label>
      <div class="grid grid-cols-4 gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <button
          v-for="f in FREQUENCIES"
          :key="f.value"
          type="button"
          :class="[
            'py-1.5 text-xs font-medium rounded-md transition-colors',
            form.paymentFrequency === f.value ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
          ]"
          @click="form.paymentFrequency = f.value"
        >{{ t(f.label) }}</button>
      </div>
      <BaseInput
        v-if="form.paymentFrequency === 'custom'"
        v-model="form.customIntervalDays"
        type="number"
        :label="t('custom_interval_days')"
        placeholder="30"
        class="mt-2"
        :required="true"
      />
    </div>

    <!-- Interest — collapsed by default per spec 12.20 ("don't overcomplicate for a simple fixed-amount loan") -->
    <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('has_interest') }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('has_interest_desc') }}</p>
      </div>
      <button
        type="button"
        class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
        :class="form.hasInterest ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
        @click="form.hasInterest = !form.hasInterest"
      >
        <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200" :class="form.hasInterest ? 'translate-x-6' : 'translate-x-1'" />
      </button>
    </div>
    <div v-if="form.hasInterest" class="space-y-1.5">
      <BaseInput v-model="form.interestRate" type="number" :label="t('interest_rate_optional')" placeholder="0.0" />
      <p class="text-xs text-amber-600 dark:text-amber-400">{{ t('interest_not_calculated_note') }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('notes') }}</label>
      <textarea
        v-model="form.notes"
        rows="2"
        :placeholder="t('notes_placeholder')"
        class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      ></textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>{{ t('cancel') }}</BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>{{ isEditing ? t('update_loan') : t('add_loan') }}</BaseButton>
    </div>
  </form>
</template>
