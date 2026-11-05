<script setup>
/** One limit row: label · spent / limit · bar · "left" — status by icon + text, not colour alone. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleAlert, TriangleAlert, CalendarDays } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  row: { type: Object, required: true },     // from limitUsage()
  label: { type: String, required: true },
  icon: { type: String, default: '' },       // category icon key ('' for total)
  note: { type: String, default: '' },       // e.g. active dates "Nov 5 – Nov 20"
})
const { t } = useI18n()
const { formatCurrency } = useFormat()
const bar = computed(() => (props.row.level === 'over' ? 'bg-red-500' : props.row.level === 'warn' ? 'bg-amber-400' : 'bg-primary-500'))
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="flex items-center gap-1.5 min-w-0 text-sm text-gray-700 dark:text-gray-200">
        <AppIcon v-if="icon" :name="icon" fallback="tag" size="xs" class="text-gray-400 shrink-0" />
        <span class="truncate">{{ label }}</span>
      </span>
      <span class="tabular text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
        {{ formatCurrency(row.spent) }} / {{ formatCurrency(row.limit) }}
      </span>
    </div>
    <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" :aria-valuenow="Math.min(row.pct, 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="label">
      <div :class="['h-full rounded-full transition-[width] duration-500 ease-out', bar]" :style="{ width: Math.min(row.pct, 100) + '%' }" />
    </div>
    <div class="mt-1 flex items-center justify-between gap-2 text-xs">
      <p class="flex items-center gap-1" :class="row.level === 'over' ? 'text-red-600 dark:text-red-400 font-semibold' : row.level === 'warn' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-400 dark:text-gray-500'">
        <AppIcon v-if="row.level === 'over'" :icon="CircleAlert" size="xs" />
        <AppIcon v-else-if="row.level === 'warn'" :icon="TriangleAlert" size="xs" />
        <span class="tabular">{{ row.remaining >= 0 ? t('limits.left', { amount: formatCurrency(row.remaining) }) : t('limits.over_by', { amount: formatCurrency(-row.remaining) }) }}</span>
      </p>
      <p v-if="note" class="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 font-medium whitespace-nowrap">
        <AppIcon :icon="CalendarDays" size="xs" />{{ note }}
      </p>
    </div>
  </div>
</template>
