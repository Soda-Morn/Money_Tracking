<script setup>
/**
 * Grid picker for data icons (categories, savings goals).
 * v-model holds the icon KEY that gets saved in Firestore's `icon` field.
 */
import AppIcon from './AppIcon.vue'

defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, required: true }, // list of icon keys from src/icons
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div role="radiogroup" :aria-label="label || undefined"
       class="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 -m-1">
    <button
      v-for="key in options"
      :key="key"
      type="button"
      role="radio"
      :aria-checked="modelValue === key"
      :aria-label="key"
      :title="key"
      :class="[
        'aspect-square rounded-xl flex items-center justify-center transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        modelValue === key
          ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-gray-700 dark:hover:text-white'
      ]"
      @click="emit('update:modelValue', key)"
    >
      <AppIcon :name="key" size="button" />
    </button>
  </div>
</template>
