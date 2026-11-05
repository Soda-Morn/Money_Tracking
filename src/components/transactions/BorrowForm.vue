<script setup>
import { ref, computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useI18n } from 'vue-i18n'
import { HandCoins, Undo2 } from 'lucide-vue-next'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import AmountInput from '../ui/AmountInput.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'

const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({})
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  // Parent sets this while the save request is in flight
  saving: {
    type: Boolean,
    default: false
  }
})

const { getCurrentDate } = useFormat()

const form = ref({
  type: props.initialData.type || 'borrow',
  name: props.initialData.name || '',
  amount: props.initialData.amount != null ? String(props.initialData.amount) : '',
  description: props.initialData.description || '',
  date: props.initialData.date || getCurrentDate()
})

const typeOptions = computed(() => [
  { value: 'borrow', label: t('borrow'), icon: HandCoins, activeClass: 'text-primary-600 dark:text-primary-300' },
  { value: 'payback', label: t('payback'), icon: Undo2, activeClass: 'text-tertiary-600 dark:text-tertiary-300' },
])

// Name is required (not just cosmetic) — records with no name are unreachable
// in the Active Balances list, which groups and filters entirely by name.
const isValid = computed(() => form.value.amount > 0 && form.value.date && form.value.name.trim().length > 0)

// Validation messages appear only after the first save attempt
const attempted = ref(false)
const amountError = computed(() => attempted.value && !(form.value.amount > 0) ? t('error_amount_required') : '')
const nameError = computed(() => attempted.value && !form.value.name.trim() ? t('error_name_required') : '')

const handleSubmit = () => {
  attempted.value = true
  if (!isValid.value) return
  emit('submit', { ...form.value, amount: Number(form.value.amount) })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
    <!-- Borrow / Payback -->
    <SegmentedControl
      v-model="form.type"
      :options="typeOptions"
      :label="t('add_borrow_payback')"
    />

    <!-- Amount (hero field) -->
    <AmountInput
      v-model="form.amount"
      :label="form.type === 'borrow' ? t('borrow_amount') : t('payback_amount')"
      tone="neutral"
      :error="amountError"
      :autofocus="!isEditing"
    />

    <!-- Person -->
    <BaseInput
      v-model="form.name"
      :label="t('name')"
      placeholder="e.g., John Doe"
      :required="true"
      :error="nameError"
      autocomplete="name"
      enterkeyhint="next"
    />

    <!-- Date + note -->
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="form.date"
        type="date"
        :label="t('date')"
        :required="true"
      />
      <BaseInput
        v-model="form.description"
        :label="t('note_optional')"
        :placeholder="t('description_placeholder')"
        maxlength="120"
        enterkeyhint="done"
      />
    </div>

    <!-- Actions: primary action first on mobile (closest to the thumb) -->
    <div class="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" size="lg" full-width :loading="saving">
        {{ isEditing ? t('save_changes') : t('save_transaction') }}
      </BaseButton>
    </div>
  </form>
</template>
