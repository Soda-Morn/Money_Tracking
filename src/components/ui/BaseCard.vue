<script setup>
defineProps({
  padding: {
    type: String,
    default: 'p-4 md:p-6'
  }
})
</script>

<template>
  <div :class="['bg-white rounded-xl shadow-sm border border-gray-100', padding]">
    <slot></slot>
  </div>
</template>
