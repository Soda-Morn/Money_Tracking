<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import { useCategories } from '../composables/useCategories'
import SummaryCards from '../components/transactions/SummaryCards.vue'
import TransactionList from '../components/transactions/TransactionList.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import MobileFAB from '../components/ui/MobileFAB.vue'
import { useToast } from '../composables/useToast'
import { useI18n } from 'vue-i18n'

const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions()
const toast = useToast()
const { getMonthName, formatCurrency, formatDate } = useFormat()
const { getCategoryInfo } = useCategories()

// ── Month filter ─────────────────────────────────────────────────────────────
// null = show ALL transactions (default); 'YYYY-MM' = filter to that month
const now = new Date()
const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const selectedMonth = ref(null)

const { t } = useI18n()

const monthLabel = computed(() => {
  if (!selectedMonth.value) return t('all_transactions')
  const [year, month] = selectedMonth.value.split('-').map(Number)
  return `${getMonthName(month - 1)} ${year}`
})

const prevMonth = () => {
  if (!selectedMonth.value) {
    selectedMonth.value = toMonthKey(now)
    return
  }
  const [year, month] = selectedMonth.value.split('-').map(Number)
  selectedMonth.value = toMonthKey(new Date(year, month - 2))
}

const nextMonth = () => {
  if (!selectedMonth.value) {
    selectedMonth.value = toMonthKey(now)
    return
  }
  const [year, month] = selectedMonth.value.split('-').map(Number)
  selectedMonth.value = toMonthKey(new Date(year, month))
}

const clearMonthFilter = () => {
  selectedMonth.value = null
  showMonthPicker.value = false
}

// ── Month picker ──────────────────────────────────────────────────────────────
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const showMonthPicker = ref(false)
const pickerYear = ref(now.getFullYear())

const openPicker = () => {
  pickerYear.value = selectedMonth.value
    ? Number(selectedMonth.value.split('-')[0])
    : now.getFullYear()
  showMonthPicker.value = true
}

const closePicker = () => { showMonthPicker.value = false }

const isMonthSelected = (i) => {
  if (!selectedMonth.value) return false
  const [year, month] = selectedMonth.value.split('-').map(Number)
  return pickerYear.value === year && i === month - 1
}

const selectMonth = (i) => {
  selectedMonth.value = `${pickerYear.value}-${String(i + 1).padStart(2, '0')}`
  showMonthPicker.value = false
}

// ── Filtered data ─────────────────────────────────────────────────────────────
// null selectedMonth → return all; otherwise filter by month prefix
const filteredTransactions = computed(() => {
  if (!selectedMonth.value) return transactions.value
  return transactions.value.filter(t => t.date.startsWith(selectedMonth.value))
})

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

const filteredBorrow = computed(() =>
  filteredTransactions.value
    .filter(t => t.type === 'borrow')
    .reduce((sum, t) => sum + Number(t.amount), 0)
)

const filteredPayback = computed(() =>
  filteredTransactions.value
    .filter(t => t.type === 'payback')
    .reduce((sum, t) => sum + Number(t.amount), 0)
)

const filteredBalance = computed(() => filteredIncome.value - filteredExpense.value + filteredBorrow.value - filteredPayback.value)

// ── Transaction list controls ─────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { label: t('all'),     value: 'all' },
  { label: t('income'),  value: 'income' },
  { label: t('expense'), value: 'expense' }
]
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const pageSize = ref(5)

const updatePageSize = () => {
  pageSize.value = window.innerWidth >= 640 ? 10 : 5
}

const typeFilter     = ref('all')
const dateFilter     = ref(null)   // 'YYYY-MM-DD' | null
const showDatePicker = ref(false)
const currentPage    = ref(1)

// When month changes: clear date filter and go back to page 1
watch(selectedMonth, () => {
  dateFilter.value = null
  showDatePicker.value = false
  currentPage.value = 1
})
// When type or date filter changes: reset page only
watch([typeFilter, dateFilter], () => { currentPage.value = 1 })
watch(pageSize, () => { currentPage.value = 1 })

onMounted(() => {
  updatePageSize()
  window.addEventListener('resize', updatePageSize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePageSize)
})

const typeFilteredTransactions = computed(() => {
  if (typeFilter.value === 'all') return filteredTransactions.value
  return filteredTransactions.value.filter(t => t.type === typeFilter.value)
})

const dateFilteredTransactions = computed(() => {
  if (!dateFilter.value) return typeFilteredTransactions.value
  return typeFilteredTransactions.value.filter(t => t.date === dateFilter.value)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(dateFilteredTransactions.value.length / pageSize.value))
)

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return dateFilteredTransactions.value.slice(start, start + pageSize.value)
})

watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

// ── Calendar (date filter) — only active when a month is selected ─────────────
const calendarDays = computed(() => {
  if (!selectedMonth.value) return []
  const [year, month] = selectedMonth.value.split('-').map(Number)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = Array(firstDayOfWeek).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
})

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
  if (!day || !selectedMonth.value) return
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
const showAddModal  = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const editingTransaction = ref(null)
const viewingTransaction = ref(null)

// Delete confirm dialog
const showDeleteDialog  = ref(false)
const deletingId        = ref(null)
const deletingCategory  = ref('')

const handleAdd = async (data) => {
  await addTransaction(data)
  showAddModal.value = false
  toast.success(t('toast_transaction_added'))
}

const handleEdit = (transaction) => {
  editingTransaction.value = transaction
  showEditModal.value = true
}

const handleView = (transaction) => {
  viewingTransaction.value = transaction
  showViewModal.value = true
}

const handleUpdate = async (data) => {
  await updateTransaction(editingTransaction.value.id, data)
  showEditModal.value = false
  editingTransaction.value = null
  toast.success(t('toast_transaction_updated'))
}

const handleDelete = (id) => {
  const tx = transactions.value.find(t => t.id === id)
  deletingId.value = id
  deletingCategory.value = tx ? getCategoryInfo(tx.category, tx.type).label : ''
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (deletingId.value) {
    await deleteTransaction(deletingId.value)
    toast.success(t('toast_transaction_deleted'))
  }
  showDeleteDialog.value = false
  deletingId.value = null
  deletingCategory.value = ''
}

const cancelDelete = () => {
  showDeleteDialog.value = false
  deletingId.value = null
  deletingCategory.value = ''
}
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-end lg:justify-between gap-3">
      <div class="hidden lg:block">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('pages.dashboard') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('track_income_expenses') }}</p>
      </div>
      <BaseButton class="w-auto" @click="showAddModal = true">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        {{ t('add_transaction') }}
      </BaseButton>
    </div>

    <!-- Month Filter Navigator -->
    <div class="relative">
      <div v-if="showMonthPicker" class="fixed inset-0 z-20" @click="closePicker"></div>

      <!-- Navigator bar -->
      <div class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-2 py-1">
        <button
          class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="prevMonth"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Label + optional clear button -->
        <div class="flex items-center gap-1">
          <button
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="openPicker"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ monthLabel }}</span>
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="showMonthPicker ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- × clear button — only when a month is active -->
          <button
            v-if="selectedMonth"
            class="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md transition-colors"
            :title="t('all_transactions')"
            @click="clearMonthFilter"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          class="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
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
          class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg z-30 p-3"
        >
          <!-- Show All button -->
          <button
            :class="[
              'w-full py-2 mb-3 text-sm font-medium rounded-lg transition-colors',
              !selectedMonth
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
            ]"
            @click="clearMonthFilter"
          >
            {{ t('all_transactions') }}
          </button>

          <!-- Year Navigator -->
          <div class="flex items-center justify-between mb-3">
            <button
              class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              @click="pickerYear--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ pickerYear }}</span>
            <button
              class="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
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
              :class="[
                'py-2.5 text-sm rounded-lg font-medium transition-colors',
                isMonthSelected(i)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              ]"
              @click="selectMonth(i)"
            >
              {{ name }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Summary Cards -->
    <SummaryCards
      :total-income="filteredIncome"
      :total-expense="filteredExpense"
      :total-balance="filteredBalance"
    />

    <!-- Transactions List -->
    <BaseCard>
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('transactions') }}</h2>
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ dateFilteredTransactions.length }} total</span>
      </div>

      <!-- Filter row: type pills + date toggle (calendar hidden when no month selected) -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            :class="[
              'py-1.5 text-sm font-medium rounded-md transition-colors',
              typeFilter === opt.value
                ? opt.value === 'income'
                  ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm'
                  : opt.value === 'expense'
                    ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm'
                    : 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            ]"
            @click="typeFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <!-- Calendar toggle — only when a specific month is active -->
        <button
          v-if="selectedMonth"
          :class="[
            'shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-colors',
            showDatePicker || dateFilter
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
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
        <span class="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium px-3 py-1 rounded-full">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ dateFilterLabel }}
          <button class="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100" @click="clearDateFilter">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>

      <!-- Inline Calendar (only when month selected) -->
      <Transition name="picker">
        <div v-if="showDatePicker && selectedMonth" class="mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <div class="grid grid-cols-7 mb-1">
            <span
              v-for="d in WEEK_DAYS" :key="d"
              class="text-xs text-center text-gray-400 font-medium py-1"
            >{{ d }}</span>
          </div>
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
                      ? 'text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/30'
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                ]"
                @click="selectDay(day)"
              >{{ day }}</button>
              <span v-else class="w-8 h-8"></span>

              <span
                v-if="day && daysWithTransactions.has(day)"
                :class="['w-1 h-1 rounded-full mt-0.5', selectedDay === day ? 'bg-white/70' : 'bg-blue-400']"
              ></span>
              <span v-else-if="day" class="w-1 h-1 mt-0.5"></span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Transaction List -->
      <TransactionList
        :transactions="paginatedTransactions"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          :disabled="currentPage === 1"
          :class="[
            'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
            currentPage === 1
              ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
          ]"
          @click="currentPage--"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

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
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
            ]"
            @click="currentPage = p"
          >{{ p }}</button>
        </template>

        <button
          :disabled="currentPage === totalPages"
          :class="[
            'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
            currentPage === totalPages
              ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
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
    <BaseModal :show="showAddModal" :title="t('add_transaction')" @close="showAddModal = false">
      <TransactionForm @submit="handleAdd" @cancel="showAddModal = false" />
    </BaseModal>

    <!-- Edit Transaction Modal -->
    <BaseModal :show="showEditModal" :title="t('edit_transaction')" @close="showEditModal = false">
      <TransactionForm
        v-if="editingTransaction"
        :initial-data="editingTransaction"
        :is-editing="true"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </BaseModal>

    <!-- View Transaction Modal -->
    <BaseModal :show="showViewModal" :title="t('transaction_details')" @close="showViewModal = false">
      <div v-if="viewingTransaction" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('category') }}</div>
            <div class="font-medium text-gray-900 dark:text-white truncate">
              {{ getCategoryInfo(viewingTransaction.category, viewingTransaction.type).label }}
            </div>
          </div>
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('amount') }}</div>
            <div :class="[
              'font-semibold',
              viewingTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
            ]">
              {{ viewingTransaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(viewingTransaction.amount) }}
            </div>
          </div>
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('date') }}</div>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ formatDate(viewingTransaction.date) }}
            </div>
          </div>
        </div>

        <div v-if="viewingTransaction.description" class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('description') }}</div>
          <div class="text-gray-900 dark:text-white whitespace-pre-wrap">{{ viewingTransaction.description }}</div>
        </div>

        <div class="pt-1">
          <BaseButton variant="secondary" full-width @click="showViewModal = false">{{ t('cancel') }}</BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Mobile FAB -->
    <MobileFAB @click="showAddModal = true" />

    <!-- ── Delete Confirmation Dialog ──────────────────────────────────────── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDeleteDialog"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          @click.self="cancelDelete"
        >
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-4 opacity-0 sm:scale-95"
            enter-to-class="translate-y-0 opacity-100 sm:scale-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100 sm:scale-100"
            leave-to-class="translate-y-4 opacity-0 sm:scale-95"
          >
            <div
              v-if="showDeleteDialog"
              class="relative w-full sm:max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl px-6 pt-6 pb-8 sm:pb-6"
            >
              <div class="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5 sm:hidden" />
              <div class="flex items-center justify-center mb-4">
                <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <h3 class="text-lg font-bold text-center text-gray-900 dark:text-white mb-1">
                {{ t('delete_confirm_title') }}
              </h3>
              <p class="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                <template v-if="deletingCategory">
                  {{ t('delete_confirm_name', { name: deletingCategory }) }}
                </template>
                <template v-else>
                  {{ t('delete_confirm_desc') }}
                </template>
              </p>
              <div class="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  class="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  @click="cancelDelete"
                >
                  {{ t('cancel') }}
                </button>
                <button
                  class="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors shadow-sm"
                  @click="confirmDelete"
                >
                  {{ t('delete') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
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
