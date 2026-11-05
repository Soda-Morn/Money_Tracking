<script setup>
/**
 * How expected income is allocated: planned expenses · planned savings ·
 * unallocated. A single 100% bar + labelled legend (never colour-only).
 * Over-allocation is shown explicitly instead of a misleading full bar.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({ summary: { type: Object, required: true } })
const { t } = useI18n()
const { formatCurrency } = useFormat()

const parts = computed(() => {
  const s = props.summary
  const total = Math.max(s.expectedIncome, s.plannedExpenses + s.plannedSavings) || 1
  return [
    { key: 'expenses', label: t('planner.planned_expenses'), amount: s.plannedExpenses, color: 'bg-[#f06548] dark:bg-[#e8664b]' },
    { key: 'savings', label: t('planner.planned_savings'), amount: s.plannedSavings, color: 'bg-teal-500 dark:bg-teal-500' },
    { key: 'free', label: t('planner.unallocated'), amount: Math.max(0, s.remaining), color: 'bg-gray-200 dark:bg-gray-700' },
  ].map((p) => ({ ...p, pct: (p.amount / total) * 100 }))
})
const over = computed(() => props.summary.remaining < 0)
</script>

<template>
  <div>
    <div
      class="flex h-3.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 gap-0.5"
      role="img"
      :aria-label="parts.map((p) => `${p.label} ${formatCurrency(p.amount)}`).join(', ')"
    >
      <div
        v-for="p in parts.filter((x) => x.pct > 0)"
        :key="p.key"
        :class="['h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full', p.color]"
        :style="{ width: p.pct + '%' }"
      />
    </div>

    <ul class="mt-3 flex flex-col min-[420px]:flex-row min-[420px]:flex-wrap gap-x-5 gap-y-2 text-sm">
      <li v-for="p in parts" :key="p.key" class="flex items-center gap-2 min-w-0">
        <span :class="['w-2.5 h-2.5 rounded-sm shrink-0', p.color]" aria-hidden="true" />
        <span class="text-gray-500 dark:text-gray-400">{{ p.label }}</span>
        <span class="tabular ml-auto min-[420px]:ml-1 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{{ formatCurrency(p.amount) }}</span>
      </li>
    </ul>

    <p v-if="summary.allocatedPct !== null && !over" class="mt-3 text-sm text-gray-600 dark:text-gray-300">
      {{ t('planner.allocated_pct', { pct: summary.allocatedPct }) }}
    </p>
    <p v-if="over" class="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400" role="status">
      <AppIcon :icon="TriangleAlert" size="action" class="mt-0.5" />
      {{ t('planner.over_allocated', { amount: formatCurrency(-summary.remaining) }) }}
    </p>
  </div>
</template>
