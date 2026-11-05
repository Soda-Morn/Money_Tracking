<script setup>
/**
 * Confirm a real payment for a planned expense. The actual amount can differ
 * from the plan (both are kept for comparison). Nothing is saved until the
 * parent's markPaid() succeeds.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck } from 'lucide-vue-next'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import AmountInput from '../ui/AmountInput.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  plan: { type: Object, required: true },
  categoryLabel: { type: String, default: '' },
  today: { type: String, required: true },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()
const { formatCurrency } = useFormat()

const amount = ref(String(props.plan.amount))
const date = ref(props.today)
const attempted = ref(false)

const amountError = computed(() => (attempted.value && !(Number(amount.value) > 0) ? t('error_amount_required') : ''))
const dateError = computed(() => (attempted.value && !/^\d{4}-\d{2}-\d{2}$/.test(date.value) ? t('planner.errors.date_required') : ''))
const diff = computed(() => Number(props.plan.amount) - Number(amount.value || 0))

const confirm = () => {
  attempted.value = true
  if (amountError.value || dateError.value) return
  emit('confirm', { actualAmount: Number(amount.value), paidDate: date.value })
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="confirm">
    <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-4">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('planner.paying_for') }}</p>
      <p class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ plan.name }}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ categoryLabel }} · {{ t('planner.planned_amount', { amount: formatCurrency(plan.amount) }) }}
      </p>
    </div>

    <AmountInput v-model="amount" :label="t('planner.actual_amount')" tone="expense" :error="amountError" />
    <p v-if="Number(amount) > 0 && diff !== 0" class="-mt-3 text-center text-xs" :class="diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
      {{ diff > 0 ? t('planner.less_than_planned', { amount: formatCurrency(diff) }) : t('planner.more_than_planned', { amount: formatCurrency(-diff) }) }}
    </p>

    <BaseInput v-model="date" type="date" :label="t('planner.paid_on')" :max="today" :error="dateError" :required="true" />

    <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('planner.pay_explainer') }}</p>

    <div class="flex flex-col-reverse sm:flex-row gap-2.5">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">{{ t('planner.keep_pending') }}</BaseButton>
      <BaseButton type="submit" size="lg" full-width :loading="saving">
        <AppIcon v-if="!saving" :icon="CircleCheck" size="button" />{{ t('planner.confirm_payment') }}
      </BaseButton>
    </div>
  </form>
</template>
