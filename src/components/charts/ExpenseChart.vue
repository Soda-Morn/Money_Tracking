<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useCategories } from '../../composables/useCategories'
import { useFormat } from '../../composables/useFormat'

Chart.register(...registerables)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'doughnut'
  }
})

const { getCategoryInfo } = useCategories()
const { formatCurrency } = useFormat()

const chartRef = ref(null)
let chartInstance = null

// Brand-derived palette (teal/blue/brown family), cycled by index so custom
// user-created categories get a distinct color too instead of falling back to gray.
const PALETTE = [
  '#0d4d40', '#4d88ac', '#663a21', '#227560', '#6a9cba',
  '#955f37', '#3d6f8e', '#c08e5c', '#86b4cd', '#502d1a',
  '#9ccdbe', '#b1d0e2',
]

const chartData = computed(() => {
  const grouped = {}
  props.data.forEach(t => {
    if (!grouped[t.category]) {
      grouped[t.category] = { total: 0, type: t.type }
    }
    grouped[t.category].total += Number(t.amount)
  })

  const entries = Object.entries(grouped)
  const labels = entries.map(([cat, info]) => getCategoryInfo(cat, info.type).label)
  const values = entries.map(([, info]) => info.total)
  const colors = entries.map((_, i) => PALETTE[i % PALETTE.length])
  const total = values.reduce((s, v) => s + v, 0)

  return { labels, values, colors, total }
})

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
  }

  if (!chartRef.value || chartData.value.labels.length === 0) return

  const ctx = chartRef.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: props.type,
    data: {
      labels: chartData.value.labels,
      datasets: [{
        data: chartData.value.values,
        backgroundColor: chartData.value.colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: props.type === 'doughnut' ? '68%' : undefined,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      }
    }
  })
}

onMounted(() => {
  createChart()
})

watch(() => props.data, () => {
  createChart()
}, { deep: true })
</script>

<template>
  <div class="relative h-64">
    <canvas ref="chartRef"></canvas>
    <div
      v-if="type === 'doughnut' && chartData.labels.length > 0"
      class="absolute inset-x-0 top-0 h-[calc(100%-2.75rem)] flex flex-col items-center justify-center pointer-events-none"
    >
      <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total</span>
      <span class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(chartData.total) }}</span>
    </div>
  </div>
</template>
