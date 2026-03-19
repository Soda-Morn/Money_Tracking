<script setup>
defineProps({
  padding: {
    type: String,
    default: 'p-4 md:p-5'
  }
})
</script>

<template>
  <div :class="['bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800/80', padding]">
    <slot></slot>
  </div>
</template>
