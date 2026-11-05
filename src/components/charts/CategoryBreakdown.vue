<script setup>
/**
 * Spending / income by category: donut + readable ranked list.
 *
 * - Top 6 categories are shown individually; the rest fold into "Other"
 *   (never generate extra hues).
 * - Colours follow the CATEGORY, not its rank: `colorOrder` (categories ranked
 *   by all-time total) pins each category to a palette slot, so switching the
 *   period doesn't repaint a category with a different colour.
 * - Palette = dataviz reference categorical slots 1–5, 7, 8, validated against
 *   this app's card surfaces (#ffffff light, #111827 dark): all checks pass;
 *   light-mode contrast WARN is relieved by the always-visible labelled list.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js'
import { useCategories } from '../../composables/useCategories'
import { useFormat } from '../../composables/useFormat'
import { useTheme } from '../../composables/useTheme'
import AppIcon from '../ui/AppIcon.vue'

Chart.register(DoughnutController, ArcElement, Tooltip)

const props = defineProps({
  transactions: { type: Array, default: () => [] }, // already filtered to one type + period
  type: { type: String, default: 'expense' },        // 'expense' | 'income' (for category lookup)
  colorOrder: { type: Array, default: () => [] },    // category values, stable order
})

const { t } = useI18n()
const { getCategoryInfo } = useCategories()
const { formatCurrency } = useFormat()
const { isDark } = useTheme()

const SLOTS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#e34948'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'],
}
const OTHER = { light: '#9ca3af', dark: '#6b7280' }
const SURFACE = { light: '#ffffff', dark: '#111827' }
const MAX_SLICES = 6

const mode = computed(() => (isDark.value ? 'dark' : 'light'))

const slices = computed(() => {
  const totals = new Map()
  for (const tx of props.transactions) {
    totals.set(tx.category, (totals.get(tx.category) || 0) + (Number(tx.amount) || 0))
  }
  const ranked = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const total = ranked.reduce((s, [, v]) => s + v, 0)
  const shown = ranked.length > MAX_SLICES + 1 ? ranked.slice(0, MAX_SLICES) : ranked
  const rest = ranked.slice(shown.length)

  // Stable slot per category; fall back to the first free slot on a clash
  const palette = SLOTS[mode.value]
  const used = new Set()
  const rows = shown.map(([value, amount]) => {
    let slot = props.colorOrder.indexOf(value) % palette.length
    if (slot < 0 || used.has(slot)) slot = palette.findIndex((_, i) => !used.has(i))
    used.add(slot)
    const info = getCategoryInfo(value, props.type)
    return { key: value, label: info.label, icon: info.icon, amount, color: palette[slot] }
  })
  if (rest.length) {
    rows.push({
      key: '__other',
      label: t('other_categories', { n: rest.length }),
      icon: 'tag',
      amount: rest.reduce((s, [, v]) => s + v, 0),
      color: OTHER[mode.value],
    })
  }
  return {
    total,
    rows: rows.map(r => ({ ...r, pct: total ? (r.amount / total) * 100 : 0 })),
  }
})

const pctLabel = (p) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`)

const canvas = ref(null)
let chart = null
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const render = () => {
  if (!canvas.value) return
  chart?.destroy()
  const s = slices.value
  chart = new Chart(canvas.value, {
    type: 'doughnut',
    data: {
      labels: s.rows.map(r => r.label),
      datasets: [{
        data: s.rows.map(r => r.amount),
        backgroundColor: s.rows.map(r => r.color),
        borderColor: SURFACE[mode.value], // 2px surface gap between slices
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      layout: { padding: 6 },
      animation: reducedMotion() ? false : { duration: 400, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark.value ? '#f9fafb' : '#111827',
          titleColor: isDark.value ? '#111827' : '#f9fafb',
          bodyColor: isDark.value ? '#374151' : '#e5e7eb',
          padding: 10,
          cornerRadius: 10,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: (item) => {
              const row = slices.value.rows[item.dataIndex]
              return ` ${formatCurrency(row.amount)} · ${pctLabel(row.pct)}`
            },
          },
        },
      },
    },
  })
}

onMounted(render)
onBeforeUnmount(() => { chart?.destroy(); chart = null })
watch([slices, isDark], render)
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center gap-5">
    <!-- Donut with total in the centre -->
    <div class="relative w-44 h-44 mx-auto sm:mx-0 shrink-0">
      <canvas ref="canvas" role="img" :aria-label="t(type === 'income' ? 'income_by_category' : 'expense_by_category')" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ t('total') }}</span>
        <span class="tabular text-base font-bold text-gray-900 dark:text-white max-w-[7.5rem] truncate">{{ formatCurrency(slices.total) }}</span>
      </div>
    </div>

    <!-- Ranked list doubles as the legend (identity never colour-only) -->
    <ul class="flex-1 min-w-0 divide-y divide-gray-100 dark:divide-gray-800">
      <li v-for="row in slices.rows" :key="row.key" class="flex items-center gap-3 py-2.5">
        <span class="w-1 self-stretch rounded-full shrink-0" :style="{ backgroundColor: row.color }" aria-hidden="true" />
        <AppIcon :name="row.icon" fallback="tag" size="action" class="text-gray-400 dark:text-gray-500" />
        <span class="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">{{ row.label }}</span>
        <span class="tabular text-xs text-gray-500 dark:text-gray-400 w-10 text-right shrink-0">{{ pctLabel(row.pct) }}</span>
        <span class="tabular text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap shrink-0">{{ formatCurrency(row.amount) }}</span>
      </li>
    </ul>
  </div>
</template>
