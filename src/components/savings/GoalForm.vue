<script setup>
import { ref, computed } from 'vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

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

const form = ref({
  name: props.initialData.name || '',
  targetAmount: props.initialData.targetAmount || '',
  currentAmount: props.initialData.currentAmount || 0,
  deadline: props.initialData.deadline || '',
  icon: props.initialData.icon || '🎯'
})

// Expanded icon set — 40 options
const icons = [
  '🎯', '🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🎉', '💰',
  '🏋️', '🌴', '🎸', '📷', '🏄', '🚀', '🎨', '🌎', '🐶', '🎮',
  '💎', '🏆', '🌟', '🔑', '⚡', '🌈', '🍀', '🦋', '🎪', '🛳️',
  '🏡', '🛵', '🎹', '🤿', '🧳', '🛍️', '🎂', '🌺', '🦄', '🔥'
]

const isValid = computed(() => {
  return form.value.name && form.value.targetAmount > 0
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    ...form.value,
    targetAmount: Number(form.value.targetAmount),
    currentAmount: Number(form.value.currentAmount)
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Icon Selection -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon</label>

      <!-- Preset icons grid (scrollable) -->
      <div class="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <button
          v-for="icon in icons"
          :key="icon"
          type="button"
          :class="[
            'w-10 h-10 rounded-lg text-xl transition-colors flex items-center justify-center',
            form.icon === icon
              ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500'
              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
          @click="form.icon = icon"
        >
          {{ icon }}
        </button>
      </div>

      <!-- Custom emoji input -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500 dark:text-gray-400">Or type custom icon:</span>
        <input
          v-model="form.icon"
          maxlength="2"
          class="w-14 h-10 text-center text-2xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="😀"
        />
      </div>
    </div>

    <!-- Name -->
    <BaseInput
      v-model="form.name"
      label="Goal Name"
      placeholder="e.g., New Car, Vacation, Emergency Fund"
      :required="true"
    />

    <!-- Target Amount -->
    <BaseInput
      v-model="form.targetAmount"
      type="number"
      label="Target Amount"
      placeholder="0.00"
      :required="true"
    />

    <!-- Current Amount (only for new goals) -->
    <BaseInput
      v-if="!isEditing"
      v-model="form.currentAmount"
      type="number"
      label="Initial Amount (Optional)"
      placeholder="0.00"
    />

    <!-- Deadline -->
    <BaseInput
      v-model="form.deadline"
      type="date"
      label="Target Date (Optional)"
    />

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>
        Cancel
      </BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>
        {{ isEditing ? 'Update' : 'Create' }} Goal
      </BaseButton>
    </div>
  </form>
</template>
