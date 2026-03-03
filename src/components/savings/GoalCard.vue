<script setup>
import { computed } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useSavingsGoals } from '../../composables/useSavingsGoals'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

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
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="p-4 border-b border-gray-100 dark:border-gray-700">
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'w-10 h-10 rounded-full flex items-center justify-center text-lg',
            isCompleted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
          ]">
            {{ goal.icon || '🎯' }}
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ goal.name }}</h3>
            <p v-if="goal.deadline" class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('date') }}: {{ goal.deadline }}
            </p>
          </div>
        </div>

        <!-- Completed Badge -->
        <span
          v-if="isCompleted"
          class="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full"
        >
          {{ t('completed_goals') }}
        </span>
      </div>
    </div>

    <!-- Progress -->
    <div class="p-4">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-600 dark:text-gray-400">{{ t('overall_progress') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ Math.round(progress) }}%</span>
      </div>
      <ProgressBar :progress="progress" :color="progressColor" height="h-3" />

      <div class="flex justify-between mt-3 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400">{{ t('total_saved') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(goal.currentAmount) }}</p>
        </div>
        <div class="text-right">
          <p class="text-gray-500 dark:text-gray-400">{{ t('total_target') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(goal.targetAmount) }}</p>
        </div>
      </div>

      <p v-if="!isCompleted" class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {{ formatCurrency(remaining) }} {{ t('remaining') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex border-t border-gray-100 dark:border-gray-700">
      <button
        v-if="!isCompleted"
        class="flex-1 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        @click="emit('addMoney', goal)"
      >
        {{ t('add_money') }}
      </button>
      <button
        class="flex-1 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l border-gray-100 dark:border-gray-700"
        @click="emit('edit', goal)"
      >
        {{ t('update') }}
      </button>
      <button
        class="flex-1 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-l border-gray-100 dark:border-gray-700"
        @click="emit('delete', goal.id)"
      >
        {{ t('delete') }}
      </button>
    </div>
  </div>
</template>
