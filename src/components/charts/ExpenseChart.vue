<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'

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

const chartRef = ref(null)
let chartInstance = null

const categoryLabels = {
  food: 'Food & Dining',
  transport: 'Transportation',
  shopping: 'Shopping',
  bills: 'Bills & Utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  education: 'Education',
  salary: 'Salary',
  freelance: 'Freelance',
  investment: 'Investment',
  gift: 'Gift',
  other: 'Other'
}

const categoryColors = {
  food: '#EF4444',
  transport: '#F97316',
  shopping: '#EAB308',
  bills: '#22C55E',
  entertainment: '#06B6D4',
  health: '#3B82F6',
  education: '#8B5CF6',
  salary: '#10B981',
  freelance: '#6366F1',
  investment: '#EC4899',
  gift: '#F59E0B',
  other: '#6B7280'
}

const chartData = computed(() => {
  const grouped = {}
  props.data.forEach(t => {
    if (!grouped[t.category]) {
      grouped[t.category] = 0
    }
    grouped[t.category] += Number(t.amount)
  })

  const labels = Object.keys(grouped).map(k => categoryLabels[k] || k)
  const values = Object.values(grouped)
  const colors = Object.keys(grouped).map(k => categoryColors[k] || '#6B7280')

  return { labels, values, colors }
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
  </div>
</template>
