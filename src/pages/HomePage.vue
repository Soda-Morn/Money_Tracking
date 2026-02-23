<script setup>
import { ref, computed, watch } from 'vue'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import SummaryCards from '../components/transactions/SummaryCards.vue'
import TransactionList from '../components/transactions/TransactionList.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions()
const { getMonthName } = useFormat()

// ── Month filter ─────────────────────────────────────────────────────────────
const now = new Date()
const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const selectedMonth = ref(toMonthKey(now))

const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  return `${getMonthName(month - 1)} ${year}`
})

const isCurrentMonth = computed(() => selectedMonth.value === toMonthKey(new Date()))

const prevMonth = () => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  const d = new Date(year, month - 2)
  selectedMonth.value = toMonthKey(d)
}

const nextMonth = () => {
  if (isCurrentMonth.value) return
  const [year, month] = selectedMonth.value.split('-').map(Number)
  const d = new Date(year, month)
  selectedMonth.value = toMonthKey(d)
}

// ── Month picker ──────────────────────────────────────────────────────────────
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const showMonthPicker = ref(false)
const pickerYear = ref(now.getFullYear())

const openPicker = () => {
  pickerYear.value = Number(selectedMonth.value.split('-')[0])
  showMonthPicker.value = true
}

const closePicker = () => {
  showMonthPicker.value = false
}

const isNextPickerYearDisabled = computed(() => pickerYear.value >= new Date().getFullYear())

const isMonthDisabled = (i) => {
  const n = new Date()
  return pickerYear.value > n.getFullYear() ||
    (pickerYear.value === n.getFullYear() && i > n.getMonth())
}

const isMonthSelected = (i) => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  return pickerYear.value === year && i === month - 1
}

const selectMonth = (i) => {
  if (isMonthDisabled(i)) return
  selectedMonth.value = `${pickerYear.value}-${String(i + 1).padStart(2, '0')}`
  showMonthPicker.value = false
}

// ── Filtered data ─────────────────────────────────────────────────────────────
const filteredTransactions = computed(() =>
  transactions.value.filter(t => t.date.startsWith(selectedMonth.value))
)

const filteredIncome = computed(() =>
  filteredTransactions.value
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
)

const filteredExpense = computed(() =>
  filteredTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)
)

const filteredBalance = computed(() => filteredIncome.value - filteredExpense.value)

// ── Transaction list controls ─────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { label: 'All',     value: 'all' },
  { label: 'Income',  value: 'income' },
  { label: 'Expense', value: 'expense' }
]
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const PAGE_SIZE = 8

const typeFilter     = ref('all')
const dateFilter     = ref(null)   // 'YYYY-MM-DD' | null
const showDatePicker = ref(false)
const currentPage    = ref(1)

// When month changes: clear date filter and go back to page 1
watch(selectedMonth, () => {
  dateFilter.value = null
  currentPage.value = 1
})
// When type or date filter changes: reset page only
watch([typeFilter, dateFilter], () => { currentPage.value = 1 })

const typeFilteredTransactions = computed(() => {
  if (typeFilter.value === 'all') return filteredTransactions.value
  return filteredTransactions.value.filter(t => t.type === typeFilter.value)
})

const dateFilteredTransactions = computed(() => {
  if (!dateFilter.value) return typeFilteredTransactions.value
  return typeFilteredTransactions.value.filter(t => t.date === dateFilter.value)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(dateFilteredTransactions.value.length / PAGE_SIZE))
)

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return dateFilteredTransactions.value.slice(start, start + PAGE_SIZE)
})

// ── Calendar (date filter) ────────────────────────────────────────────────────
const calendarDays = computed(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = Array(firstDayOfWeek).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
})

// Dots: all days that have any transaction (based on month filter, before type filter)
const daysWithTransactions = computed(() => {
  const days = new Set()
  filteredTransactions.value.forEach(t => days.add(Number(t.date.split('-')[2])))
  return days
})

const selectedDay = computed(() =>
  dateFilter.value ? Number(dateFilter.value.split('-')[2]) : null
)

const dateFilterLabel = computed(() => {
  if (!dateFilter.value) return null
  const [, month, day] = dateFilter.value.split('-').map(Number)
  return `${shortMonths[month - 1]} ${day}`
})

const selectDay = (day) => {
  if (!day) return
  const [year, month] = selectedMonth.value.split('-')
  const key = `${year}-${month}-${String(day).padStart(2, '0')}`
  dateFilter.value = dateFilter.value === key ? null : key
}

const clearDateFilter = () => { dateFilter.value = null }

// ── Pagination — visible page numbers with ellipsis ──────────────────────────
const visiblePageNumbers = computed(() => {
  const total = totalPages.value
  const cur   = currentPage.value
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3)            pages.push('...')
  const lo = Math.max(2, cur - 1)
  const hi = Math.min(total - 1, cur + 1)
  for (let p = lo; p <= hi; p++) pages.push(p)
  if (cur < total - 2)    pages.push('...')
  pages.push(total)
  return pages
})

// ── Modal state ───────────────────────────────────────────────────────────────
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingTransaction = ref(null)

const handleAdd = (data) => {
  addTransaction(data)
  showAddModal.value = false
}

const handleEdit = (transaction) => {
  editingTransaction.value = transaction
  showEditModal.value = true
}

const handleUpdate = (data) => {
  updateTransaction(editingTransaction.value.id, data)
  showEditModal.value = false
  editingTransaction.value = null
}

const handleDelete = (id) => {
  if (confirm('Are you sure you want to delete this transaction?')) {
    deleteTransaction(id)
  }
}
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <!-- Title: hidden on mobile since MobileHeader already shows it -->
      <div class="hidden lg:block">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-sm text-gray-500 mt-1">Track your income and expenses</p>
      </div>
      <BaseButton class="w-full lg:w-auto" @click="showAddModal = true">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Transaction
      </BaseButton>
    </div>

    <!-- Month Filter Navigator -->
    <div class="relative">
      <!-- Transparent backdrop — closes picker on tap-outside -->
      <div v-if="showMonthPicker" class="fixed inset-0 z-20" @click="closePicker"></div>

      <!-- Navigator bar -->
      <div class="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-2 py-1">
        <button
          class="p-2 text-gray-500 hover:text-gray-900 active:text-gray-900 hover:bg-gray-100 active:bg-gray-100 rounded-lg transition-colors"
          @click="prevMonth"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Tappable label — opens the month grid picker -->
        <button
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-100 transition-colors"
          @click="openPicker"
        >
          <span class="text-sm font-semibold text-gray-900">{{ monthLabel }}</span>
          <svg
            class="w-4 h-4 text-gray-400 transition-transform duration-200"
            :class="showMonthPicker ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          :class="[
            'p-2 rounded-lg transition-colors',
            isCurrentMonth
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-900 active:text-gray-900 hover:bg-gray-100 active:bg-gray-100'
          ]"
          :disabled="isCurrentMonth"
          @click="nextMonth"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Month Picker Dropdown -->
      <Transition name="picker">
        <div
          v-if="showMonthPicker"
          class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-100 shadow-lg z-30 p-3"
        >
          <!-- Year Navigator -->
          <div class="flex items-center justify-between mb-3">
            <button
              class="p-2 text-gray-500 hover:text-gray-900 active:text-gray-900 hover:bg-gray-100 active:bg-gray-100 rounded-lg transition-colors"
              @click="pickerYear--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm font-semibold text-gray-900">{{ pickerYear }}</span>
            <button
              :class="[
                'p-2 rounded-lg transition-colors',
                isNextPickerYearDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-900 active:text-gray-900 hover:bg-gray-100 active:bg-gray-100'
              ]"
              :disabled="isNextPickerYearDisabled"
              @click="pickerYear++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Month Grid -->
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="(name, i) in shortMonths"
              :key="i"
              :disabled="isMonthDisabled(i)"
              :class="[
                'py-2.5 text-sm rounded-lg font-medium transition-colors',
                isMonthSelected(i)
                  ? 'bg-blue-600 text-white'
                  : isMonthDisabled(i)
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100 active:bg-gray-100'
              ]"
              @click="selectMonth(i)"
            >
              {{ name }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Summary Cards (filtered by selected month) -->
    <SummaryCards
      :total-income="filteredIncome"
      :total-expense="filteredExpense"
      :total-balance="filteredBalance"
    />

    <!-- Transactions List -->
    <BaseCard>
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-900">Transactions</h2>
        <span class="text-sm text-gray-500">{{ dateFilteredTransactions.length }} total</span>
      </div>

      <!-- Filter row: type pills + date toggle -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            :class="[
              'py-1.5 text-sm font-medium rounded-md transition-colors',
              typeFilter === opt.value
                ? opt.value === 'income'
                  ? 'bg-white text-green-600 shadow-sm'
                  : opt.value === 'expense'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 active:bg-white/50'
            ]"
            @click="typeFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <!-- Calendar toggle button -->
        <button
          :class="[
            'shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-colors',
            showDatePicker || dateFilter
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100'
          ]"
          @click="showDatePicker = !showDatePicker"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <!-- Active date chip -->
      <div v-if="dateFilter" class="flex items-center gap-2 mb-3">
        <span class="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ dateFilterLabel }}
          <button class="ml-0.5 hover:text-blue-900" @click="clearDateFilter">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>

      <!-- Inline Calendar -->
      <Transition name="picker">
        <div v-if="showDatePicker" class="mb-4 bg-gray-50 rounded-xl p-3">
          <!-- Day-of-week headers -->
          <div class="grid grid-cols-7 mb-1">
            <span
              v-for="d in WEEK_DAYS" :key="d"
              class="text-xs text-center text-gray-400 font-medium py-1"
            >{{ d }}</span>
          </div>

          <!-- Day cells -->
          <div class="grid grid-cols-7 gap-y-1">
            <div
              v-for="(day, i) in calendarDays"
              :key="i"
              class="flex flex-col items-center"
            >
              <button
                v-if="day"
                :class="[
                  'w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors font-medium',
                  selectedDay === day
                    ? 'bg-blue-600 text-white'
                    : daysWithTransactions.has(day)
                      ? 'text-gray-900 hover:bg-blue-50 active:bg-blue-100'
                      : 'text-gray-400 hover:bg-gray-100 active:bg-gray-200'
                ]"
                @click="selectDay(day)"
              >{{ day }}</button>
              <span v-else class="w-8 h-8"></span>

              <!-- Transaction dot -->
              <span
                v-if="day && daysWithTransactions.has(day)"
                :class="[
                  'w-1 h-1 rounded-full mt-0.5',
                  selectedDay === day ? 'bg-white/70' : 'bg-blue-400'
                ]"
              ></span>
              <span v-else-if="day" class="w-1 h-1 mt-0.5"></span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Transaction List -->
      <TransactionList
        :transactions="paginatedTransactions"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100">
        <!-- Prev -->
        <button
          :disabled="currentPage === 1"
          :class="[
            'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
            currentPage === 1
              ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'
              : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100 shadow-sm'
          ]"
          @click="currentPage--"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Page numbers / ellipsis -->
        <template v-for="p in visiblePageNumbers" :key="p">
          <span
            v-if="p === '...'"
            class="w-10 h-10 flex items-center justify-center text-sm text-gray-400"
          >…</span>
          <button
            v-else
            :class="[
              'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
              p === currentPage
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 shadow-sm'
            ]"
            @click="currentPage = p"
          >{{ p }}</button>
        </template>

        <!-- Next -->
        <button
          :disabled="currentPage === totalPages"
          :class="[
            'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
            currentPage === totalPages
              ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'
              : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100 shadow-sm'
          ]"
          @click="currentPage++"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </BaseCard>

    <!-- Add Transaction Modal -->
    <BaseModal
      :show="showAddModal"
      title="Add Transaction"
      @close="showAddModal = false"
    >
      <TransactionForm
        @submit="handleAdd"
        @cancel="showAddModal = false"
      />
    </BaseModal>

    <!-- Edit Transaction Modal -->
    <BaseModal
      :show="showEditModal"
      title="Edit Transaction"
      @close="showEditModal = false"
    >
      <TransactionForm
        v-if="editingTransaction"
        :initial-data="editingTransaction"
        :is-editing="true"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </BaseModal>
  </div>
</template>

<style scoped>
.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.picker-enter-from,
.picker-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
