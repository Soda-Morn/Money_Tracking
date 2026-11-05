<script setup>
import { LoaderCircle } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  fullWidth: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  // Shows a spinner and blocks clicks while an async action runs
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

// Solid colours (no gradients) — calmer and more trustworthy for a finance app.
const variantClasses = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-900/10 focus-visible:ring-primary-500',
  secondary: 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:ring-gray-400',
  danger:    'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-900/10 focus-visible:ring-red-500',
  ghost:     'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-gray-400',
}

// md/lg meet the 44px minimum touch target; sm is for dense desktop toolbars.
const sizeClasses = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}
</script>

<template>
  <button
    :class="[
      'pressable inline-flex items-center justify-center font-semibold rounded-xl select-none',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? 'w-full' : '',
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    @click="emit('click', $event)"
  >
    <AppIcon v-if="loading" :icon="LoaderCircle" size="button" class="animate-spin" />
    <slot></slot>
  </button>
</template>
