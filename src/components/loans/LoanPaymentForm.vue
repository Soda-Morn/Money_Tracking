<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useLoans } from '../../composables/useLoans'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

const props = defineProps({
  loan: { type: Object, required: true },
  initialData: { type: Object, default: () => ({}) }, // present when editing an existing payment
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()
const { formatCurrency, getCurrentDate } = useFormat()
const { getRemainingBalance } = useLoans()

const form = ref({
  amount: props.initialData.amount != null ? String(props.initialData.amount) : '',
  paymentDate: props.initialData.paymentDate || getCurrentDate(),
  paymentMethod: props.initialData.paymentMethod || '',
  note: props.initialData.note || '',
})

const submitting = ref(false)
const overrideToFinal = ref(false) // true once the user confirms "pay remaining & complete loan"

// When editing an existing payment, "remaining before" should exclude that
// payment's own amount (it's already counted in the stored balance) so the
// preview reflects what remaining would be if this payment didn't exist yet.
const remainingBefore = computed(() => {
  const base = getRemainingBalance(props.loan)
  return props.isEditing ? base + Number(props.initialData.amount || 0) : base
})

const enteredAmount = computed(() => Number(form.value.amount) || 0)
const isOverpayment = computed(() => !overrideToFinal.value && enteredAmount.value > remainingBefore.value && remainingBefore.value > 0)
const remainingAfter = computed(() => Math.max(0, Math.round((remainingBefore.value - enteredAmount.value) * 100) / 100))

const isValid = computed(() => enteredAmount.value > 0 && !!form.value.paymentDate)

const handleSubmit = () => {
  if (!isValid.value || isOverpayment.value || submitting.value) return
  submitting.value = true
  emit('submit', {
    amount: enteredAmount.value,
    paymentDate: form.value.paymentDate,
    paymentMethod: form.value.paymentMethod,
    note: form.value.note,
  })
}

const confirmFinalPayment = () => {
  overrideToFinal.value = true
  form.value.amount = String(remainingBefore.value)
  handleSubmit()
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <BaseInput v-model="form.amount" type="number" :label="t('payment_amount')" placeholder="0.00" :required="true" @input="overrideToFinal = false" />
    <BaseInput v-model="form.paymentDate" type="date" :label="t('payment_date')" :required="true" />
    <BaseInput v-model="form.paymentMethod" :label="t('payment_method_optional')" :placeholder="t('payment_method_placeholder')" />
    <BaseInput v-model="form.note" :label="t('note_optional')" :placeholder="t('description_placeholder')" />

    <!-- Remaining Before / Payment / Remaining After preview -->
    <div v-if="enteredAmount > 0" class="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
      <div>
        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{{ t('remaining_before') }}</p>
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatCurrency(remainingBefore) }}</p>
      </div>
      <div class="text-center">
        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{{ t('payment') }}</p>
        <p class="text-sm font-semibold text-primary-600 dark:text-primary-400">−{{ formatCurrency(enteredAmount) }}</p>
      </div>
      <div class="text-right">
        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{{ t('remaining_after') }}</p>
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatCurrency(remainingAfter) }}</p>
      </div>
    </div>

    <!-- Overpayment confirmation — replaces the normal action row -->
    <div v-if="isOverpayment" class="space-y-3">
      <div class="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <span class="text-lg leading-none">⚠️</span>
        <p class="text-sm text-amber-700 dark:text-amber-400">
          {{ t('overpayment_warning', { remaining: formatCurrency(remainingBefore) }) }}
        </p>
      </div>
      <div class="flex gap-3">
        <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>{{ t('cancel') }}</BaseButton>
        <BaseButton type="button" full-width @click="confirmFinalPayment">
          {{ t('pay_and_complete', { amount: formatCurrency(remainingBefore) }) }}
        </BaseButton>
      </div>
    </div>

    <div v-else class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>{{ t('cancel') }}</BaseButton>
      <BaseButton type="submit" :disabled="!isValid || submitting" full-width>{{ t('confirm_payment') }}</BaseButton>
    </div>
  </form>
</template>
