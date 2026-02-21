<script setup>
defineProps({
  progress: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: 'blue'
  },
  height: {
    type: String,
    default: 'h-2'
  },
  showLabel: {
    type: Boolean,
    default: false
  }
})

const colorClasses = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  yellow: 'bg-yellow-500'
}
</script>

<template>
  <div class="space-y-1">
    <div v-if="showLabel" class="flex justify-between text-sm">
      <span class="text-gray-600">Progress</span>
      <span class="font-medium text-gray-900">{{ Math.round(progress) }}%</span>
    </div>
    <div :class="['w-full bg-gray-200 rounded-full overflow-hidden', height]">
      <div
        :class="['h-full rounded-full transition-all duration-500', colorClasses[color] || color]"
        :style="{ width: `${Math.min(100, progress)}%` }"
      ></div>
    </div>
  </div>
</template>
