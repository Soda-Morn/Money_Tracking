<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import IconPicker from '../ui/IconPicker.vue'
import { GOAL_ICON_KEYS } from '../../icons'

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
  }
})

const form = ref({
  name: props.initialData.name || '',
  targetAmount: props.initialData.targetAmount || '',
  currentAmount: props.initialData.currentAmount || 0,
  deadline: props.initialData.deadline || '',
  icon: props.initialData.icon || 'target',
  priority: props.initialData.priority || 'medium'
})

const priorityOptions = [
  { value: 'low',    label: 'priority_low' },
  { value: 'medium', label: 'priority_medium' },
  { value: 'high',   label: 'priority_high' },
]

// Saved amount may be 0 but never negative or non-numeric
const savedAmountInvalid = computed(() => {
  const v = String(form.value.currentAmount ?? '').trim()
  return v !== '' && !(Number(v) >= 0)
})

const isValid = computed(() => {
  return form.value.name && form.value.targetAmount > 0 && !savedAmountInvalid.value
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    ...form.value,
    targetAmount: Number(form.value.targetAmount),
    currentAmount: Number(form.value.currentAmount) || 0
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Icon Selection -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('icon_label') }}</label>
      <IconPicker v-model="form.icon" :options="GOAL_ICON_KEYS" :label="t('icon_label')" />
    </div>

    <!-- Name -->
    <BaseInput
      v-model="form.name"
      :label="t('goal_name')"
      placeholder="e.g., New Car, Vacation, Emergency Fund"
      :required="true"
    />

    <!-- Priority -->
    <div class="space-y-1.5">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('priority') }}</label>
      <div class="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <button
          v-for="opt in priorityOptions"
          :key="opt.value"
          type="button"
          :class="[
            'py-1.5 text-sm font-medium rounded-md transition-colors',
            form.priority === opt.value
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          ]"
          @click="form.priority = opt.value"
        >{{ t(opt.label) }}</button>
      </div>
    </div>

    <!-- Target Amount -->
    <BaseInput
      v-model="form.targetAmount"
      type="number"
      :label="t('target_amount')"
      placeholder="0.00"
      :required="true"
    />

    <!-- Amount saved: starting amount for new goals, editable later to correct mistakes -->
    <div>
      <BaseInput
        v-model="form.currentAmount"
        inputmode="decimal"
        :label="isEditing ? t('saved_so_far') : t('initial_amount_optional')"
        placeholder="0.00"
        :error="savedAmountInvalid ? t('saved_amount_invalid') : ''"
      />
      <p v-if="isEditing && !savedAmountInvalid" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('saved_so_far_hint') }}</p>
    </div>

    <!-- Deadline -->
    <BaseInput
      v-model="form.deadline"
      type="date"
      :label="t('target_date_optional')"
    />

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>
        {{ isEditing ? t('update') : t('create') }} {{ t('goal') }}
      </BaseButton>
    </div>
  </form>
</template>
