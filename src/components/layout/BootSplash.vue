<script setup>
// Same look as the static splash in index.html, so loading → app is seamless.
import { useI18n } from 'vue-i18n'
import { Wallet } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-primary-700 flex items-center justify-center" role="status">
    <div class="flex flex-col items-center gap-4">
      <div class="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shadow-xl mb-2">
        <AppIcon :icon="Wallet" :size="36" class="text-white" />
      </div>
      <div class="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
      <p class="text-sm text-white/70 font-medium tracking-wide">{{ t('loading') }}</p>
    </div>
  </div>
</template>
