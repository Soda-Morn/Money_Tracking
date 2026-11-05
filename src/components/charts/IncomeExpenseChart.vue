<script setup>
/**
 * Income vs Expenses — grouped (side-by-side, NOT stacked) monthly columns.
 *
 * Data: the real transactions from Firestore (via props). Only `income` and
 * `expense` records are counted — borrow/payback are loans, not spending.
 * Months are bucketed by the 'YYYY-MM' prefix of each record's date string,
 * so there is no timezone shifting.
 *
 * Colours were validated with the dataviz palette checker (lightness band,
 * chroma, colour-blind separation ΔE ≥ 10, contrast ≥ 3:1) separately for the
 * light (#ffffff) and dark (#111827) card surfaces.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import { useTheme } from '../../composables/useTheme'
import { useFormat } from '../../composables/useFormat'
import { useCurrency } from '../../composables/useCurrency'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  // [{ year: 2026, month: 0-11 }, ...] in display order (oldest → newest)
  months: { type: Array, required: true },
})

const { t, locale } = useI18n()
const { isDark } = useTheme()
const { formatCurrency } = useFormat()
const { currency, convertAmount } = useCurrency()

const PALETTE = {
  light: { income: '#0e9f8e', expense: '#f06548', text: '#6b7280', grid: 'rgba(17,24,39,0.06)', surface: '#ffffff' },
  dark:  { income: '#16a08b', expense: '#e8664b', text: '#9ca3af', grid: 'rgba(255,255,255,0.07)', surface: '#111827' },
}
const colors = computed(() => (isDark.value ? PALETTE.dark : PALETTE.light))

const keyOf = ({ year, month }) => `${year}-${String(month + 1).padStart(2, '0')}`

// ── Real totals per month (display only — nothing is written back) ──────────
const series = computed(() => {
  const wanted = new Map(props.months.map(m => [keyOf(m), { income: 0, expense: 0 }]))
  for (const tx of props.transactions) {
    if (!tx.date || (tx.type !== 'income' && tx.type !== 'expense')) continue
    const bucket = wanted.get(tx.date.slice(0, 7))
    if (bucket) bucket[tx.type] += Number(tx.amount) || 0
  }
  const rows = props.months.map(m => ({ ...m, ...wanted.get(keyOf(m)) }))
  return {
    rows,
    income: rows.map(r => r.income),
    expense: rows.map(r => r.expense),
    hasData: rows.some(r => r.income > 0 || r.expense > 0),
  }
})

const spansYears = computed(() => new Set(props.months.map(m => m.year)).size > 1)

const monthName = (m, style) =>
  new Date(m.year, m.month, 1).toLocaleDateString(locale.value || 'en-US', { month: style })

// Axis label: short month; add the 2-digit year when the range crosses a year
const shortLabel = (m, i) => {
  const base = monthName(m, 'short')
  return spansYears.value && (i === 0 || m.month === 0) ? `${base} ${String(m.year).slice(2)}` : base
}
const longLabel = (m) =>
  new Date(m.year, m.month, 1).toLocaleDateString(locale.value || 'en-US', { month: 'long', year: 'numeric' })

// Compact axis money in the user's display currency (e.g. $1.2K, ៛5M)
const compactMoney = (usd) => new Intl.NumberFormat(locale.value || 'en-US', {
  style: 'currency',
  currency: currency.value,
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(convertAmount(usd))

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── Chart.js lifecycle: one instance, updated in place for smooth transitions ──
const canvas = ref(null)
let chart = null

const buildConfig = () => {
  const c = colors.value
  const bar = (label, data, color) => ({
    label,
    data,
    backgroundColor: color,
    hoverBackgroundColor: color,
    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, // round data-end, square baseline
    borderSkipped: 'start',
    maxBarThickness: 24,
    barPercentage: 0.82,     // leaves a visible gap between the income and expense bar
    categoryPercentage: 0.72,
  })

  return {
    type: 'bar',
    data: {
      labels: props.months.map(shortLabel),
      datasets: [
        bar(t('income'), series.value.income, c.income),
        bar(t('expense'), series.value.expense, c.expense),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reducedMotion() ? false : { duration: 300, easing: 'easeOutCubic' },
      // Hovering/tapping anywhere in a month's column shows both values —
      // a far bigger touch target than a thin bar.
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4 } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: c.text,
            font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            maxRotation: 0,
            autoSkip: false,
            // Switch to single-letter months when the columns get narrow (12 months on a phone)
            callback(value, index) {
              const m = props.months[index]
              if (!m) return ''
              const perColumn = (this.chart.chartArea?.width || this.chart.width) / props.months.length
              return perColumn < 34 ? monthName(m, 'narrow') : shortLabel(m, index)
            },
          },
        },
        y: {
          beginAtZero: true,
          grace: '8%',
          border: { display: false },
          grid: { color: c.grid, drawTicks: false },
          ticks: {
            // No data → no meaningless "$0.5 / $1.5" scale behind the empty message
            display: series.value.hasData,
            color: c.text,
            font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            padding: 8,
            maxTicksLimit: 5,
            callback: (v) => compactMoney(v),
          },
        },
      },
      plugins: {
        legend: { display: false }, // accessible HTML legend is rendered below
        tooltip: {
          backgroundColor: isDark.value ? '#f9fafb' : '#111827',
          titleColor: isDark.value ? '#111827' : '#f9fafb',
          bodyColor: isDark.value ? '#374151' : '#e5e7eb',
          footerColor: isDark.value ? '#111827' : '#f9fafb',
          padding: 12,
          cornerRadius: 10,
          boxPadding: 6,
          usePointStyle: true,
          titleFont: { weight: '600' },
          footerFont: { weight: '600' },
          callbacks: {
            title: (items) => longLabel(props.months[items[0].dataIndex]),
            label: (item) => ` ${item.dataset.label}: ${formatCurrency(item.raw)}`,
            footer: (items) => {
              const row = series.value.rows[items[0].dataIndex]
              const net = row.income - row.expense
              return `${t('net')}: ${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`
            },
          },
        },
      },
    },
  }
}

const render = () => {
  if (!canvas.value) return
  if (chart) chart.destroy()
  chart = new Chart(canvas.value, buildConfig())
}

// Data / period change → update in place so bars animate to their new height
const update = () => {
  if (!chart) return render()
  const cfg = buildConfig()
  chart.options.scales.y.ticks.display = series.value.hasData
  chart.data.labels = cfg.data.labels
  cfg.data.datasets.forEach((ds, i) => {
    Object.assign(chart.data.datasets[i], { data: ds.data, label: ds.label })
  })
  chart.update()
}

onMounted(render)
onBeforeUnmount(() => { chart?.destroy(); chart = null })

watch(() => [series.value, props.months], update, { deep: false })
// Theme / language / currency change → rebuild colours, labels and formats
watch([isDark, locale, currency], render)
</script>

<template>
  <figure class="m-0">
    <!-- Legend (HTML, so it's readable by screen readers and never colour-only) -->
    <figcaption class="flex items-center gap-4 mb-3 text-xs font-medium text-gray-600 dark:text-gray-300">
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: colors.income }" aria-hidden="true" />
        {{ t('income') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: colors.expense }" aria-hidden="true" />
        {{ t('expense') }}
      </span>
    </figcaption>

    <div class="relative h-60 sm:h-72">
      <canvas ref="canvas" role="img" :aria-label="t('income_vs_expenses')" />
      <!-- Empty overlay keeps the axes visible so the layout doesn't jump -->
      <div
        v-if="!series.hasData"
        class="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/70 rounded-xl"
      >
        {{ t('chart_no_data_period') }}
      </div>
    </div>

    <!-- Same numbers as a table for screen readers -->
    <table class="sr-only">
      <caption>{{ t('income_vs_expenses') }}</caption>
      <thead>
        <tr><th scope="col">{{ t('month') }}</th><th scope="col">{{ t('income') }}</th><th scope="col">{{ t('expense') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in series.rows" :key="keyOf(row)">
          <th scope="row">{{ longLabel(row) }}</th>
          <td>{{ formatCurrency(row.income) }}</td>
          <td>{{ formatCurrency(row.expense) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
