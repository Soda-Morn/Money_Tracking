<script setup>
import { ChevronDown } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const handleChange = (event) => {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" class="block text-sm font-semibold text-gray-700 dark:text-gray-300">
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>
    <!-- Same height/radius/border as BaseInput so forms line up -->
    <div class="relative">
      <select
        :value="modelValue"
        :required="required"
        class="w-full h-12 pl-3.5 pr-10 appearance-none border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base sm:text-sm transition-colors duration-150 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
        @change="handleChange"
      >
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <AppIcon :icon="ChevronDown" size="action" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  </div>
</template>
