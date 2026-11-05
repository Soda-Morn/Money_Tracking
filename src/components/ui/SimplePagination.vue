<script setup>
/** Compact prev / "Page x of y" / next control with 44px touch targets. */
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  page: { type: Number, required: true },   // 1-based
  pages: { type: Number, required: true },
})
const emit = defineEmits(['update:page'])
const { t } = useI18n()

const go = (p) => emit('update:page', Math.min(props.pages, Math.max(1, p)))
</script>

<template>
  <nav v-if="pages > 1" class="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800" :aria-label="t('pagination')">
    <button
      type="button"
      class="pressable w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
      :disabled="page <= 1"
      :aria-label="t('previous')"
      @click="go(page - 1)"
    >
      <AppIcon :icon="ChevronLeft" size="button" />
    </button>
    <span class="tabular text-sm font-medium text-gray-600 dark:text-gray-300" aria-live="polite">
      {{ t('page_of', { page, pages }) }}
    </span>
    <button
      type="button"
      class="pressable w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
      :disabled="page >= pages"
      :aria-label="t('next')"
      @click="go(page + 1)"
    >
      <AppIcon :icon="ChevronRight" size="button" />
    </button>
  </nav>
</template>
