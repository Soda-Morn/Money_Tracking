<script setup>
import { ref, computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'

const props = defineProps({
  goal: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['submit', 'cancel'])

const { formatCurrency } = useFormat()

const amount = ref('')

const remaining = computed(() => props.goal.targetAmount - props.goal.currentAmount)
const isValid = computed(() => amount.value > 0)

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', Number(amount.value))
}

const setQuickAmount = (percentage) => {
  amount.value = Math.round(remaining.value * percentage)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Goal Info -->
    <div class="bg-gray-50 rounded-lg p-4">
      <div class="flex items-center space-x-3 mb-3">
        <span class="text-2xl">{{ goal.icon || '🎯' }}</span>
        <h3 class="font-semibold text-gray-900">{{ goal.name }}</h3>
      </div>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-gray-500">Current</p>
          <p class="font-medium text-gray-900">{{ formatCurrency(goal.currentAmount) }}</p>
        </div>
        <div>
          <p class="text-gray-500">Remaining</p>
          <p class="font-medium text-gray-900">{{ formatCurrency(remaining) }}</p>
        </div>
      </div>
    </div>

    <!-- Quick Amount Buttons -->
    <div class="space-y-1">
      <label class="block text-sm font-medium text-gray-700">Quick Select</label>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="setQuickAmount(0.1)"
        >
          10%
        </button>
        <button
          type="button"
          class="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="setQuickAmount(0.25)"
        >
          25%
        </button>
        <button
          type="button"
          class="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="setQuickAmount(0.5)"
        >
          50%
        </button>
        <button
          type="button"
          class="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          @click="setQuickAmount(1)"
        >
          100%
        </button>
      </div>
    </div>

    <!-- Amount Input -->
    <BaseInput
      v-model="amount"
      type="number"
      label="Amount to Add"
      placeholder="0.00"
      :required="true"
    />

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')" full-width>
        Cancel
      </BaseButton>
      <BaseButton type="submit" :disabled="!isValid" full-width>
        Add Money
      </BaseButton>
    </div>
  </form>
</template>
