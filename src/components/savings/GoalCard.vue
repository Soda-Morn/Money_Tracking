<script setup>
import { computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useSavingsGoals } from '../../composables/useSavingsGoals'
import ProgressBar from '../ui/ProgressBar.vue'

const props = defineProps({
  goal: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'addMoney'])

const { formatCurrency } = useFormat()
const { getProgress } = useSavingsGoals()

const progress = computed(() => getProgress(props.goal))
const remaining = computed(() => Math.max(0, props.goal.targetAmount - props.goal.currentAmount))
const isCompleted = computed(() => props.goal.currentAmount >= props.goal.targetAmount)

const progressColor = computed(() => {
  if (isCompleted.value) return 'green'
  if (progress.value >= 75) return 'blue'
  if (progress.value >= 50) return 'yellow'
  return 'blue'
})
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="p-4 border-b border-gray-100">
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'w-10 h-10 rounded-full flex items-center justify-center text-lg',
            isCompleted ? 'bg-green-100' : 'bg-blue-100'
          ]">
            {{ goal.icon || '🎯' }}
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">{{ goal.name }}</h3>
            <p v-if="goal.deadline" class="text-sm text-gray-500">
              Target: {{ goal.deadline }}
            </p>
          </div>
        </div>

        <!-- Completed Badge -->
        <span
          v-if="isCompleted"
          class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full"
        >
          Completed
        </span>
      </div>
    </div>

    <!-- Progress -->
    <div class="p-4">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-600">Progress</span>
        <span class="font-medium text-gray-900">{{ Math.round(progress) }}%</span>
      </div>
      <ProgressBar :progress="progress" :color="progressColor" height="h-3" />

      <div class="flex justify-between mt-3 text-sm">
        <div>
          <p class="text-gray-500">Saved</p>
          <p class="font-semibold text-gray-900">{{ formatCurrency(goal.currentAmount) }}</p>
        </div>
        <div class="text-right">
          <p class="text-gray-500">Target</p>
          <p class="font-semibold text-gray-900">{{ formatCurrency(goal.targetAmount) }}</p>
        </div>
      </div>

      <p v-if="!isCompleted" class="text-sm text-gray-500 mt-2">
        {{ formatCurrency(remaining) }} remaining
      </p>
    </div>

    <!-- Actions -->
    <div class="flex border-t border-gray-100">
      <button
        v-if="!isCompleted"
        class="flex-1 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        @click="emit('addMoney', goal)"
      >
        Add Money
      </button>
      <button
        class="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
        @click="emit('edit', goal)"
      >
        Edit
      </button>
      <button
        class="flex-1 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border-l border-gray-100"
        @click="emit('delete', goal.id)"
      >
        Delete
      </button>
    </div>
  </div>
</template>
