<script setup>
import { ref, computed } from 'vue'
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

    <!-- Transactions List (filtered by selected month) -->
    <BaseCard>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Transactions</h2>
        <span class="text-sm text-gray-500">{{ filteredTransactions.length }} total</span>
      </div>
      <TransactionList
        :transactions="filteredTransactions"
        @edit="handleEdit"
        @delete="handleDelete"
      />
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
