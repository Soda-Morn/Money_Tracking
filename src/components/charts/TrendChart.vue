<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  period: {
    type: String,
    default: 'daily'
  }
})

const chartRef = ref(null)
let chartInstance = null

const chartData = computed(() => {
  // Group transactions by date
  const incomeByDate = {}
  const expenseByDate = {}

  props.data.forEach(t => {
    const date = t.date
    if (t.type === 'income') {
      incomeByDate[date] = (incomeByDate[date] || 0) + Number(t.amount)
    } else {
      expenseByDate[date] = (expenseByDate[date] || 0) + Number(t.amount)
    }
  })

  // Get all unique dates and sort them
  const allDates = [...new Set([...Object.keys(incomeByDate), ...Object.keys(expenseByDate)])]
    .sort()
    .slice(-14) // Last 14 days

  const labels = allDates.map(d => {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const incomeData = allDates.map(d => incomeByDate[d] || 0)
  const expenseData = allDates.map(d => expenseByDate[d] || 0)

  return { labels, incomeData, expenseData }
})

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
  }

  if (!chartRef.value) return

  const ctx = chartRef.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.value.labels,
      datasets: [
        {
          label: 'Income',
          data: chartData.value.incomeData,
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Expense',
          data: chartData.value.expenseData,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
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
  <div class="relative h-72">
    <canvas ref="chartRef"></canvas>
  </div>
</template>
