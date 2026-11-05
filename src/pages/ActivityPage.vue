<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import { useCategories } from '../composables/useCategories'
import TransactionList from '../components/transactions/TransactionList.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { ChevronLeft, ChevronRight, ChevronDown, FileDown, LoaderCircle, Search, X, CalendarDays, Plus } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import { useQuickAdd } from '../composables/useQuickAdd'
import { useI18n } from 'vue-i18n'

const { transactions, updateTransaction, deleteTransaction } = useTransactions()
const quickAdd = useQuickAdd()
const toast = useToast()
// PDF libraries (jsPDF + html2canvas, ~180 kB gzip) are downloaded only when
// the user actually exports — not every time this page opens.
const exportToPdf = async (options) => {
  const { usePdfExport } = await import('../composables/usePdfExport')
  return usePdfExport().exportToPdf(options)
}
const { currentUser } = useAuth()
const { getMonthName, formatCurrency, formatDate } = useFormat()
const { getCategoryInfo } = useCategories()

// ── Month filter ─────────────────────────────────────────────────────────────
// null = show ALL transactions (default); 'YYYY-MM' = filter to that month
const now = new Date()
const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Default to the current month so users immediately see their month's data
const selectedMonth = ref(toMonthKey(now))

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
const categoryFilter  = ref('')
const searchQuery     = ref('')
const dateFilter     = ref(null)   // 'YYYY-MM-DD' | null
const showDatePicker = ref(false)
const currentPage    = ref(1)

// When month changes: clear date filter and go back to page 1
watch(selectedMonth, () => {
  dateFilter.value = null
  showDatePicker.value = false
  currentPage.value = 1
})
// When any filter changes: reset page only
watch([typeFilter, categoryFilter, searchQuery, dateFilter], () => { currentPage.value = 1 })
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

// Distinct categories present in the type-filtered set — powers the Category dropdown
const categoryOptions = computed(() => {
  const seen = new Map()
  typeFilteredTransactions.value.forEach(t => {
    if (!t.category || seen.has(t.category)) return
    const info = getCategoryInfo(t.category, t.type)
    seen.set(t.category, { value: t.category, label: info.label, icon: info.icon })
  })
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
})

const categoryFilteredTransactions = computed(() => {
  if (!categoryFilter.value) return typeFilteredTransactions.value
  return typeFilteredTransactions.value.filter(t => t.category === categoryFilter.value)
})

const searchFilteredTransactions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return categoryFilteredTransactions.value
  return categoryFilteredTransactions.value.filter(t => {
    const desc = (t.description || t.name || '').toLowerCase()
    const amountStr = String(t.amount)
    return desc.includes(q) || amountStr.includes(q)
  })
})

const dateFilteredTransactions = computed(() => {
  if (!dateFilter.value) return searchFilteredTransactions.value
  return searchFilteredTransactions.value.filter(t => t.date === dateFilter.value)
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

// ── Active filter chips ───────────────────────────────────────────────────────
const activeChips = computed(() => {
  const chips = []
  if (selectedMonth.value) chips.push({ key: 'month', label: monthLabel.value, clear: clearMonthFilter })
  if (typeFilter.value !== 'all') {
    const opt = TYPE_OPTIONS.find(o => o.value === typeFilter.value)
    chips.push({ key: 'type', label: opt?.label, clear: () => { typeFilter.value = 'all' } })
  }
  if (categoryFilter.value) {
    const cat = categoryOptions.value.find(c => c.value === categoryFilter.value)
    chips.push({ key: 'category', label: cat ? cat.label : categoryFilter.value, clear: () => { categoryFilter.value = '' } })
  }
  if (searchQuery.value.trim()) {
    chips.push({ key: 'search', label: `"${searchQuery.value.trim()}"`, clear: () => { searchQuery.value = '' } })
  }
  if (dateFilter.value) {
    const [, month, day] = dateFilter.value.split('-').map(Number)
    chips.push({ key: 'date', label: `${shortMonths[month - 1]} ${day}`, clear: () => { dateFilter.value = null } })
  }
  return chips
})

const clearAllFilters = () => {
  typeFilter.value = 'all'
  categoryFilter.value = ''
  searchQuery.value = ''
  dateFilter.value = null
}

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

const selectDay = (day) => {
  if (!day || !selectedMonth.value) return
  const [year, month] = selectedMonth.value.split('-')
  const key = `${year}-${month}-${String(day).padStart(2, '0')}`
  dateFilter.value = dateFilter.value === key ? null : key
}

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
const showEditModal = ref(false)
const showViewModal = ref(false)
const editingTransaction = ref(null)
const viewingTransaction = ref(null)

// Delete confirm dialog
const showDeleteDialog  = ref(false)
const deletingId        = ref(null)
const deletingCategory  = ref('')
const deleting          = ref(false)
const saving            = ref(false)

const deleteMessage = computed(() =>
  deletingCategory.value
    ? t('delete_confirm_name', { name: deletingCategory.value })
    : t('delete_confirm_desc')
)

// ── PDF Export ────────────────────────────────────────────────────────────────
const isExporting = ref(false)

const handleExportPdf = async () => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    await new Promise(r => setTimeout(r, 50)) // let spinner render
    await exportToPdf({
      transactions: dateFilteredTransactions.value,
      monthLabel: monthLabel.value,
      income:   dateFilteredTransactions.value.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense:  dateFilteredTransactions.value.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      balance:  dateFilteredTransactions.value.reduce((s, t) => s + (t.type === 'income' || t.type === 'borrow' ? Number(t.amount) : -Number(t.amount)), 0),
      formatCurrency,
      getCategoryInfo,
      userName: currentUser.value?.displayName || currentUser.value?.email || null,
    })
    toast.success('PDF exported successfully')
  } catch (e) {
    toast.error(t('toast_export_error'))
  } finally {
    isExporting.value = false
  }
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
  if (saving.value || !editingTransaction.value) return
  saving.value = true
  try {
    await updateTransaction(editingTransaction.value.id, data)
    showEditModal.value = false
    editingTransaction.value = null
    toast.success(t('toast_transaction_updated'))
  } catch (e) {
    toast.error(t('toast_save_error'))
  } finally {
    saving.value = false
  }
}

const closeEditModal = () => {
  if (saving.value) return
  showEditModal.value = false
}

const handleDelete = (id) => {
  const tx = transactions.value.find(t => t.id === id)
  deletingId.value = id
  deletingCategory.value = tx ? getCategoryInfo(tx.category, tx.type).label : ''
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (deleting.value) return
  if (!deletingId.value) {
    cancelDelete()
    return
  }
  deleting.value = true
  try {
    await deleteTransaction(deletingId.value)
    toast.success(t('toast_transaction_deleted'))
    showDeleteDialog.value = false
    deletingId.value = null
    deletingCategory.value = ''
  } catch (e) {
    // Keep the dialog open so the user can retry or cancel
    toast.error(t('toast_delete_error'))
  } finally {
    deleting.value = false
  }
}

const cancelDelete = () => {
  if (deleting.value) return
  showDeleteDialog.value = false
  deletingId.value = null
  deletingCategory.value = ''
}
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Page Header -->
    <div class="hidden lg:flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('pages.activity') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('track_income_expenses') }}</p>
      </div>
      <BaseButton class="shrink-0" @click="quickAdd.open('expense')">
        <AppIcon :icon="Plus" size="button" />
        {{ t('add_transaction') }}
      </BaseButton>
    </div>

    <!-- Month Filter Navigator -->
    <div class="relative">
      <div v-if="showMonthPicker" class="fixed inset-0 z-20" @click="closePicker"></div>

      <div class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm px-2 py-1">
        <button
          class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          :aria-label="t('previous')"
          @click="prevMonth"
        >
          <AppIcon :icon="ChevronLeft" size="nav" />
        </button>

        <div class="flex items-center gap-1">
          <button
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="openPicker"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ monthLabel }}</span>
            <AppIcon
              :icon="ChevronDown"
              size="action"
              class="text-gray-400 transition-transform duration-200"
              :class="showMonthPicker ? 'rotate-180' : ''"
            />
          </button>
        </div>

        <button
          class="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
          :aria-label="t('next')"
          @click="nextMonth"
        >
          <AppIcon :icon="ChevronRight" size="nav" />
        </button>
      </div>

      <Transition name="picker">
        <div
          v-if="showMonthPicker"
          class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg z-30 p-3"
        >
          <button
            :class="[
              'w-full py-2 mb-3 text-sm font-medium rounded-lg transition-colors',
              !selectedMonth
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
            ]"
            @click="clearMonthFilter"
          >
            {{ t('all_transactions') }}
          </button>

          <div class="flex items-center justify-between mb-3">
            <button
              class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              :aria-label="t('previous')"
              @click="pickerYear--"
            >
              <AppIcon :icon="ChevronLeft" size="action" />
            </button>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ pickerYear }}</span>
            <button
              class="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('next')"
              @click="pickerYear++"
            >
              <AppIcon :icon="ChevronRight" size="action" />
            </button>
          </div>

          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="(name, i) in shortMonths"
              :key="i"
              :class="[
                'py-2.5 text-sm rounded-lg font-medium transition-colors',
                isMonthSelected(i)
                  ? 'bg-primary-600 text-white'
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

    <!-- Transactions List -->
    <BaseCard>
      <!-- Header (title hidden on mobile — the app header already says "Transactions") -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 class="hidden sm:block text-lg font-semibold text-gray-900 dark:text-white">{{ t('transactions') }}</h2>
        <span class="tabular text-sm text-gray-500 dark:text-gray-400">{{ dateFilteredTransactions.length }} {{ t('total').toLowerCase() }}</span>
        <button
          type="button"
          :disabled="isExporting || dateFilteredTransactions.length === 0"
          class="pressable h-11 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400"
          :title="t('export_pdf') + ' · ' + monthLabel"
          :aria-busy="isExporting ? 'true' : undefined"
          @click="handleExportPdf"
        >
          <AppIcon v-if="!isExporting" :icon="FileDown" size="action" />
          <AppIcon v-else :icon="LoaderCircle" size="action" class="animate-spin" />
          PDF
        </button>
      </div>

      <!-- Search -->
      <div class="relative mb-3">
        <AppIcon :icon="Search" size="action" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="search"
          enterkeyhint="search"
          :placeholder="t('search_placeholder')"
          class="w-full h-12 pl-10 pr-12 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          :aria-label="t('clear_search')"
          @click="searchQuery = ''"
        >
          <AppIcon :icon="X" size="action" />
        </button>
      </div>

      <!-- Filters: on phones the type toggle gets its own full-width row,
           category + date share the second row. One row from sm and up. -->
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-3">
        <div role="radiogroup" :aria-label="t('transactions')" class="basis-full sm:basis-auto sm:flex-1 grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="typeFilter === opt.value"
            :class="[
              'h-10 px-2 text-sm font-semibold rounded-lg transition-colors truncate',
              typeFilter === opt.value
                ? opt.value === 'income'
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : opt.value === 'expense'
                    ? 'bg-white dark:bg-gray-700 text-red-500 dark:text-red-400 shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            ]"
            @click="typeFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <div class="relative flex-1 min-w-0 sm:flex-none sm:w-44">
          <select
            v-model="categoryFilter"
            :aria-label="t('category')"
            class="w-full h-12 pl-3.5 pr-9 appearance-none text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white truncate focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          >
            <option value="">{{ t('category') }}</option>
            <option v-for="cat in categoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
          <AppIcon :icon="ChevronDown" size="action" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <!-- Calendar toggle — only when a specific month is active -->
        <button
          v-if="selectedMonth"
          type="button"
          :class="[
            'shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border transition-colors',
            showDatePicker || dateFilter
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          ]"
          :aria-label="t('date')"
          :aria-pressed="showDatePicker ? 'true' : 'false'"
          @click="showDatePicker = !showDatePicker"
        >
          <AppIcon :icon="CalendarDays" size="button" />
        </button>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeChips.length > 0" class="flex flex-wrap items-center gap-2 mb-3">
        <span
          v-for="chip in activeChips"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium px-3 py-1 rounded-full"
        >
          {{ chip.label }}
          <button type="button" class="-my-2 -mr-2 w-8 h-8 inline-flex items-center justify-center rounded-full hover:text-primary-900 dark:hover:text-primary-100" :aria-label="t('remove_filter')" @click="chip.clear">
            <AppIcon :icon="X" size="xs" />
          </button>
        </span>
        <button
          class="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline decoration-dotted"
          @click="clearAllFilters"
        >{{ t('clear_all') }}</button>
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
                    ? 'bg-primary-600 text-white'
                    : daysWithTransactions.has(day)
                      ? 'text-gray-900 dark:text-white hover:bg-primary-50 dark:hover:bg-primary-900/30'
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                ]"
                @click="selectDay(day)"
              >{{ day }}</button>
              <span v-else class="w-8 h-8"></span>

              <span
                v-if="day && daysWithTransactions.has(day)"
                :class="['w-1 h-1 rounded-full mt-0.5', selectedDay === day ? 'bg-white/70' : 'bg-primary-400']"
              ></span>
              <span v-else-if="day" class="w-1 h-1 mt-0.5"></span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Transaction List (grouped by date) -->
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
          :aria-label="t('previous')"
          @click="currentPage--"
        >
          <AppIcon :icon="ChevronLeft" size="action" />
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
                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
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
          :aria-label="t('next')"
          @click="currentPage++"
        >
          <AppIcon :icon="ChevronRight" size="action" />
        </button>
      </div>
    </BaseCard>

    <!-- Edit Transaction Modal -->
    <BaseModal :show="showEditModal" :title="t('edit_transaction')" @close="closeEditModal">
      <TransactionForm
        v-if="editingTransaction"
        :initial-data="editingTransaction"
        :is-editing="true"
        :saving="saving"
        @submit="handleUpdate"
        @cancel="closeEditModal"
      />
    </BaseModal>

    <!-- View Transaction Modal -->
    <BaseModal :show="showViewModal" :title="t('transaction_details')" @close="showViewModal = false">
      <div v-if="viewingTransaction" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('category') }}</div>
            <div class="font-medium text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
              <AppIcon :name="getCategoryInfo(viewingTransaction.category, viewingTransaction.type).icon" fallback="tag" size="action" class="text-gray-500 dark:text-gray-400" />
              <span class="truncate">{{ getCategoryInfo(viewingTransaction.category, viewingTransaction.type).label }}</span>
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

    <!-- Delete Confirmation -->
    <ConfirmDialog
      :show="showDeleteDialog"
      :title="t('delete_confirm_title')"
      :message="deleteMessage"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
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
