<script setup>
defineEmits(['click'])
</script>

<template>
  <!-- Floating Action Button — mobile only, sits above the bottom nav -->
  <div class="lg:hidden fixed bottom-[4.75rem] right-4 z-40" style="bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px))">
    <button
      class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/40 flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
      @click="$emit('click')"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
</template>
