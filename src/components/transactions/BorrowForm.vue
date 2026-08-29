<script setup>
import { ref, computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useI18n } from 'vue-i18n'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

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

const { getCurrentDate } = useFormat()

const form = ref({
  type: props.initialData.type || 'borrow',
  name: props.initialData.name || '',
  amount: props.initialData.amount != null ? String(props.initialData.amount) : '',
  description: props.initialData.description || '',
  date: props.initialData.date || getCurrentDate()
})

// Name is required (not just cosmetic) — records with no name are unreachable
// in the Active Balances list, which groups and filters entirely by name.
const isValid = computed(() => form.value.amount > 0 && form.value.date && form.value.name.trim().length > 0)

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', { ...form.value, amount: Number(form.value.amount) })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Type Selection -->
    <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <button
        type="button"
        :class="[
          'py-2 px-4 rounded-md font-medium transition-colors',
          form.type === 'borrow'
            ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="form.type = 'borrow'"
      >
        {{ t('borrow') }}
      </button>
      <button
        type="button"
        :class="[
          'py-2 px-4 rounded-md font-medium transition-colors',
          form.type === 'payback'
            ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="form.type = 'payback'"
      >
        {{ t('payback') }}
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="form.name"
        :label="t('name')"
        placeholder="e.g., John Doe"
        :required="true"
      />
      <BaseInput
        v-model="form.amount"
        type="number"
        :label="form.type === 'borrow' ? t('borrow_amount') : t('payback_amount')"
        placeholder="0.00"
        :required="true"
      />
    </div>

    <BaseInput
      v-model="form.description"
      :label="t('description')"
      :placeholder="t('description_placeholder')"
    />

    <BaseInput
      v-model="form.date"
      type="date"
      :label="t('date')"
      :required="true"
    />

    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>
        {{ isEditing ? t('update') : t('add') }}
      </BaseButton>
    </div>
  </form>
</template>
