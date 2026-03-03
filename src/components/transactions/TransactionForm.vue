<script setup>
import { ref, computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useCategories } from '../../composables/useCategories'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseSelect from '../ui/BaseSelect.vue'

const emit = defineEmits(['submit', 'cancel'])

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
const { expenseCategories, incomeCategories } = useCategories()

const form = ref({
  type: props.initialData.type || 'expense',
  amount: props.initialData.amount || '',
  category: props.initialData.category || '',
  description: props.initialData.description || '',
  date: props.initialData.date || getCurrentDate()
})

const categoryOptions = computed(() => {
  return form.value.type === 'expense' ? expenseCategories.value : incomeCategories.value
})

const isValid = computed(() => {
  return form.value.amount > 0 && form.value.category && form.value.date
})

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
          form.type === 'expense'
            ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="form.type = 'expense'"
      >
        Expense
      </button>
      <button
        type="button"
        :class="[
          'py-2 px-4 rounded-md font-medium transition-colors',
          form.type === 'income'
            ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="form.type = 'income'"
      >
        Income
      </button>
    </div>

    <!-- Amount -->
    <BaseInput
      v-model="form.amount"
      type="number"
      label="Amount"
      placeholder="0.00"
      :required="true"
    />

    <!-- Category -->
    <BaseSelect
      v-model="form.category"
      label="Category"
      :options="categoryOptions"
      :required="true"
    />

    <!-- Description -->
    <BaseInput
      v-model="form.description"
      label="Description"
      placeholder="Enter description (optional)"
    />

    <!-- Date -->
    <BaseInput
      v-model="form.date"
      type="date"
      label="Date"
      :required="true"
    />

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>
        Cancel
      </BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>
        {{ isEditing ? 'Update' : 'Add' }} Transaction
      </BaseButton>
    </div>
  </form>
</template>
