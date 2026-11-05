<script setup>
import { computed } from 'vue'
import { Inbox, ChartPie, Target, Wallet, PiggyBank, HandCoins, Receipt } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  title: {
    type: String,
    default: 'No data'
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'folder'
  }
})

// String keys stay backward compatible with existing callers.
const ICONS = {
  folder: Inbox,
  chart: ChartPie,
  target: Target,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  'hand-coins': HandCoins,
  receipt: Receipt,
}
const iconComponent = computed(() => ICONS[props.icon] || Inbox)
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 mb-4 rounded-2xl flex items-center justify-center bg-primary-50 text-primary-400 dark:bg-gray-800 dark:text-gray-500">
      <AppIcon :icon="iconComponent" size="hero" />
    </div>

    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">{{ title }}</h3>
    <p v-if="description" class="text-gray-500 dark:text-gray-400 max-w-sm">{{ description }}</p>
    <div class="mt-4">
      <slot></slot>
    </div>
  </div>
</template>
