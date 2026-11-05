<script setup>
import { Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'

defineEmits(['click'])
const { t } = useI18n()
</script>

<template>
  <!-- Mobile: sits above the bottom nav bar -->
  <div
    class="lg:hidden fixed right-4 z-40"
    style="bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px))"
  >
    <button
      class="w-11 h-11 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl shadow-xl shadow-primary-500/40 flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
      :aria-label="t('add')"
      @click="$emit('click')"
    >
      <AppIcon :icon="Plus" size="card" />
    </button>
  </div>

  <!-- Desktop: sits at bottom-right of the viewport -->
  <div class="hidden lg:block fixed bottom-8 right-8 z-40">
    <button
      class="w-11 h-11 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl shadow-xl shadow-primary-500/40 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform duration-150"
      :aria-label="t('add')"
      @click="$emit('click')"
    >
      <AppIcon :icon="Plus" size="card" />
    </button>
  </div>
</template>
