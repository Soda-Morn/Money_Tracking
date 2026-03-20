<script setup>
defineEmits(['click'])
</script>

<template>
  <!-- Mobile: sits above the bottom nav bar -->
  <div
    class="lg:hidden fixed right-4 z-40"
    style="bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px))"
  >
    <button
      class="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/40 flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
      @click="$emit('click')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>

  <!-- Desktop: sits at bottom-right of the viewport -->
  <div class="hidden lg:block fixed bottom-8 right-8 z-40">
    <button
      class="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/40 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform duration-150"
      @click="$emit('click')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
</template>
