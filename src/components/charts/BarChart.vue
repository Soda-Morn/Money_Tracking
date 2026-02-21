<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartRef = ref(null)
let chartInstance = null

const chartData = computed(() => {
  // Group by month
  const incomeByMonth = {}
  const expenseByMonth = {}

  props.data.forEach(t => {
    const date = new Date(t.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (t.type === 'income') {
      incomeByMonth[monthKey] = (incomeByMonth[monthKey] || 0) + Number(t.amount)
    } else {
      expenseByMonth[monthKey] = (expenseByMonth[monthKey] || 0) + Number(t.amount)
    }
  })

  // Get last 6 months
  const allMonths = [...new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])]
    .sort()
    .slice(-6)

  const labels = allMonths.map(m => {
    const [year, month] = m.split('-')
    const date = new Date(year, month - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  })

  const incomeData = allMonths.map(m => incomeByMonth[m] || 0)
  const expenseData = allMonths.map(m => expenseByMonth[m] || 0)

  return { labels, incomeData, expenseData }
})

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
  }

  if (!chartRef.value) return

  const ctx = chartRef.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.value.labels,
      datasets: [
        {
          label: 'Income',
          data: chartData.value.incomeData,
          backgroundColor: '#22C55E',
          borderRadius: 6
        },
        {
          label: 'Expense',
          data: chartData.value.expenseData,
          backgroundColor: '#EF4444',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
