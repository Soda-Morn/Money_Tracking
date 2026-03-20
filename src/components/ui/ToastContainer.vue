<script setup>
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()

const iconFor = (type) => ({
  success: 'M5 13l4 4L19 7',
  error:   'M6 18L18 6M6 6l12 12',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
})[type] || 'M5 13l4 4L19 7'

const colorFor = (type) => ({
  success: {
    bg:   'bg-white dark:bg-gray-800',
    icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    bar:  'bg-green-500'
  },
  error: {
    bg:   'bg-white dark:bg-gray-800',
    icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    bar:  'bg-red-500'
  },
  info: {
    bg:   'bg-white dark:bg-gray-800',
    icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    bar:  'bg-blue-500'
  }
})[type] || {}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 left-4 sm:left-auto sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup
        tag="div"
        class="flex flex-col gap-2"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-[-12px] sm:translate-y-0 sm:translate-x-4"
        enter-to-class="opacity-100 translate-y-0 sm:translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto relative flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden',
            colorFor(toast.type).bg
          ]"
        >
          <!-- Colored left bar -->
          <div :class="['absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', colorFor(toast.type).bar]" />

          <!-- Icon -->
          <div :class="['ml-1 w-8 h-8 rounded-xl flex items-center justify-center shrink-0', colorFor(toast.type).icon]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="iconFor(toast.type)" />
            </svg>
          </div>

          <!-- Message -->
          <p class="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{{ toast.message }}</p>

          <!-- Close -->
          <button
            class="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="remove(toast.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
