<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseCard from '../components/ui/BaseCard.vue'

const { t } = useI18n()
const { addTransaction, updateTransaction, deleteTransaction, transactions } = useTransactions()
const { formatCurrency, formatDate, getCurrentDate } = useFormat()

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const showViewModal = ref(false)
const viewingTransaction = ref(null)

// Form data
const form = ref({
  type: 'borrow',
  name: '',
  amount: '',
  description: '',
  date: getCurrentDate()
})

// Responsive pagination: 10 desktop, 5 mobile
const pageSize = ref(5)
const updatePageSize = () => { pageSize.value = window.innerWidth >= 640 ? 10 : 5 }

onMounted(() => {
  updatePageSize()
  window.addEventListener('resize', updatePageSize, { passive: true })
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePageSize)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
})

// Borrow and payback transactions
const borrowTransactions = computed(() =>
  transactions.value.filter(t => t.type === 'borrow')
)

const paybackTransactions = computed(() =>
  transactions.value.filter(t => t.type === 'payback')
)

// Pagination state (separate for each table)
const borrowPage = ref(1)
const paybackPage = ref(1)
watch(pageSize, () => { borrowPage.value = 1; paybackPage.value = 1 })

const borrowTotalPages = computed(() =>
  Math.max(1, Math.ceil(borrowTransactions.value.length / pageSize.value))
)
const paybackTotalPages = computed(() =>
  Math.max(1, Math.ceil(paybackTransactions.value.length / pageSize.value))
)

watch(borrowTotalPages, (tp) => { if (borrowPage.value > tp) borrowPage.value = tp })
watch(paybackTotalPages, (tp) => { if (paybackPage.value > tp) paybackPage.value = tp })

const paginatedBorrow = computed(() => {
  const start = (borrowPage.value - 1) * pageSize.value
  return borrowTransactions.value.slice(start, start + pageSize.value)
})

const paginatedPayback = computed(() => {
  const start = (paybackPage.value - 1) * pageSize.value
  return paybackTransactions.value.slice(start, start + pageSize.value)
})

const visiblePages = (total, cur) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3) pages.push('...')
  const lo = Math.max(2, cur - 1)
  const hi = Math.min(total - 1, cur + 1)
  for (let p = lo; p <= hi; p++) pages.push(p)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

const borrowVisiblePages = computed(() => visiblePages(borrowTotalPages.value, borrowPage.value))
const paybackVisiblePages = computed(() => visiblePages(paybackTotalPages.value, paybackPage.value))

// Row action menu (3-dots)
const openMenuId = ref(null)
const toggleMenu = (id) => { openMenuId.value = openMenuId.value === id ? null : id }
const closeMenu = () => { openMenuId.value = null }

const onDocClick = () => { closeMenu() }
const onDocKeydown = (event) => { if (event.key === 'Escape') closeMenu() }

// Totals
const totalBorrowed = computed(() =>
  borrowTransactions.value.reduce((sum, t) => sum + Number(t.amount), 0)
)

const totalPaidBack = computed(() =>
  paybackTransactions.value.reduce((sum, t) => sum + Number(t.amount), 0)
)

const outstandingDebt = computed(() =>
  totalBorrowed.value - totalPaidBack.value
)

// Form validation
const isValid = computed(() => {
  return form.value.amount > 0 && form.value.date
})

// Open modal for adding
const openAddModal = () => {
  form.value = {
    type: 'borrow',
    name: '',
    amount: '',
    description: '',
    date: getCurrentDate()
  }
  isEditing.value = false
  editingId.value = null
  showModal.value = true
}

const openEditModal = (transaction) => {
  form.value = {
    type: transaction.type,
    name: transaction.name || '',
    amount: String(transaction.amount ?? ''),
    description: transaction.description || '',
    date: transaction.date || getCurrentDate()
  }
  isEditing.value = true
  editingId.value = transaction.id
  showModal.value = true
}

const openViewModal = (transaction) => {
  viewingTransaction.value = transaction
  showViewModal.value = true
}

const handleDelete = async (id) => {
  if (confirm(t('delete') + '?')) {
    await deleteTransaction(id)
  }
}

// Submit form
const handleSubmit = async () => {
  if (!isValid.value) return

  const transactionData = {
    ...form.value,
    amount: Number(form.value.amount)
  }

  if (isEditing.value && editingId.value) {
    await updateTransaction(editingId.value, transactionData)
  } else {
    await addTransaction(transactionData)
  }
  showModal.value = false
}

// Close modal
const closeModal = () => {
  showModal.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('pages.borrow') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ t('track_income_expenses') }}
        </p>
      </div>
      <BaseButton @click="openAddModal" class="flex items-center gap-2 w-full sm:w-auto">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('add_borrow_payback') }}
      </BaseButton>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <BaseCard>
        <div class="flex items-center">
          <div class="p-2.5 sm:p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-3 sm:ml-4 min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ t('total_borrowed') }}
            </p>
            <p class="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
              {{ formatCurrency(totalBorrowed) }}
            </p>
          </div>

          <div v-if="borrowTotalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              :disabled="borrowPage === 1"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                borrowPage === 1
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="borrowPage--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <template v-for="p in borrowVisiblePages" :key="p">
              <span v-if="p === '...'" class="w-10 h-10 flex items-center justify-center text-sm text-gray-400">…</span>
              <button
                v-else
                :class="[
                  'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                  p === borrowPage
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                ]"
                @click="borrowPage = p"
              >{{ p }}</button>
            </template>

            <button
              :disabled="borrowPage === borrowTotalPages"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                borrowPage === borrowTotalPages
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="borrowPage++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div v-if="paybackTotalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              :disabled="paybackPage === 1"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                paybackPage === 1
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="paybackPage--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <template v-for="p in paybackVisiblePages" :key="p">
              <span v-if="p === '...'" class="w-10 h-10 flex items-center justify-center text-sm text-gray-400">…</span>
              <button
                v-else
                :class="[
                  'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                  p === paybackPage
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                ]"
                @click="paybackPage = p"
              >{{ p }}</button>
            </template>

            <button
              :disabled="paybackPage === paybackTotalPages"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                paybackPage === paybackTotalPages
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="paybackPage++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="p-2.5 sm:p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-3 sm:ml-4 min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ t('total_paid_back') }}
            </p>
            <p class="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 truncate">
              {{ formatCurrency(totalPaidBack) }}
            </p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="p-2.5 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-3 sm:ml-4 min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ t('outstanding_debt') }}
            </p>
            <p class="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
              {{ formatCurrency(outstandingDebt) }}
            </p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Tables -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <!-- Borrow Records -->
      <BaseCard>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('borrow_records') }}
          </h3>
        </div>

        <!-- Mobile list -->
        <div class="md:hidden">
          <div v-if="borrowTransactions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ t('no_transactions_title') }}
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="transaction in paginatedBorrow"
              :key="transaction.id"
              class="py-3 flex items-start justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ transaction.name || transaction.description || '-' }}
                </p>
                <p v-if="transaction.name && transaction.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ transaction.description }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ transaction.date }}</p>
              </div>
              <div class="shrink-0 flex items-center gap-1">
                <p class="text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                  {{ formatCurrency(transaction.amount) }}
                </p>

                <div class="relative">
                  <button
                    class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    :aria-expanded="openMenuId === transaction.id ? 'true' : 'false'"
                    aria-haspopup="menu"
                    @click.stop="toggleMenu(transaction.id)"
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>

                  <div
                    v-if="openMenuId === transaction.id"
                    class="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-10"
                    role="menu"
                    @click.stop
                  >
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); openViewModal(transaction)"
                    >
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {{ t('view') }}
                    </button>
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); openEditModal(transaction)"
                    >
                      <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {{ t('update') }}
                    </button>
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); handleDelete(transaction.id)"
                    >
                      <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {{ t('delete') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('date') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('name') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('amount') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('description') }}
                </th>
                <th class="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="transaction in paginatedBorrow"
                :key="transaction.id"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="py-3 px-2 text-gray-900 dark:text-white">
                  {{ transaction.date }}
                </td>
                <td class="py-3 px-2 text-gray-900 dark:text-white">
                  {{ transaction.name || '-' }}
                </td>
                <td class="py-3 px-2 text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                  {{ formatCurrency(transaction.amount) }}
                </td>
                <td class="py-3 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[18rem]">
                  {{ transaction.description || '-' }}
                </td>
                <td class="py-3 px-2 text-right">
                  <div class="relative inline-block">
                    <button
                      class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      :aria-expanded="openMenuId === transaction.id ? 'true' : 'false'"
                      aria-haspopup="menu"
                      @click.stop="toggleMenu(transaction.id)"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>

                    <div
                      v-if="openMenuId === transaction.id"
                      class="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-10"
                      role="menu"
                      @click.stop
                    >
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); openViewModal(transaction)"
                      >
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {{ t('view') }}
                      </button>
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); openEditModal(transaction)"
                      >
                        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {{ t('update') }}
                      </button>
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); handleDelete(transaction.id)"
                      >
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {{ t('delete') }}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="borrowTransactions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ t('no_transactions_title') }}
          </div>
          <div v-if="borrowTotalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              :disabled="borrowPage === 1"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                borrowPage === 1
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="borrowPage--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <template v-for="p in borrowVisiblePages" :key="p">
              <span v-if="p === '...'" class="w-10 h-10 flex items-center justify-center text-sm text-gray-400">…</span>
              <button
                v-else
                :class="[
                  'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                  p === borrowPage
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                ]"
                @click="borrowPage = p"
              >{{ p }}</button>
            </template>

            <button
              :disabled="borrowPage === borrowTotalPages"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                borrowPage === borrowTotalPages
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="borrowPage++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </BaseCard>

      <!-- Payback Records -->
      <BaseCard>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('payback_records') }}
          </h3>
        </div>

        <!-- Mobile list -->
        <div class="md:hidden">
          <div v-if="paybackTransactions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ t('no_transactions_title') }}
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="transaction in paginatedPayback"
              :key="transaction.id"
              class="py-3 flex items-start justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ transaction.name || transaction.description || '-' }}
                </p>
                <p v-if="transaction.name && transaction.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ transaction.description }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ transaction.date }}</p>
              </div>
              <div class="shrink-0 flex items-center gap-1">
                <p class="text-sm font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                  {{ formatCurrency(transaction.amount) }}
                </p>

                <div class="relative">
                  <button
                    class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    :aria-expanded="openMenuId === transaction.id ? 'true' : 'false'"
                    aria-haspopup="menu"
                    @click.stop="toggleMenu(transaction.id)"
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>

                  <div
                    v-if="openMenuId === transaction.id"
                    class="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-10"
                    role="menu"
                    @click.stop
                  >
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); openViewModal(transaction)"
                    >
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {{ t('view') }}
                    </button>
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); openEditModal(transaction)"
                    >
                      <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {{ t('update') }}
                    </button>
                    <button
                      class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      role="menuitem"
                      @click="closeMenu(); handleDelete(transaction.id)"
                    >
                      <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {{ t('delete') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('date') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('name') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('amount') }}
                </th>
                <th class="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">
                  {{ t('description') }}
                </th>
                <th class="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="transaction in paginatedPayback"
                :key="transaction.id"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="py-3 px-2 text-gray-900 dark:text-white">
                  {{ transaction.date }}
                </td>
                <td class="py-3 px-2 text-gray-900 dark:text-white">
                  {{ transaction.name || '-' }}
                </td>
                <td class="py-3 px-2 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                  {{ formatCurrency(transaction.amount) }}
                </td>
                <td class="py-3 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[18rem]">
                  {{ transaction.description || '-' }}
                </td>
                <td class="py-3 px-2 text-right">
                  <div class="relative inline-block">
                    <button
                      class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      :aria-expanded="openMenuId === transaction.id ? 'true' : 'false'"
                      aria-haspopup="menu"
                      @click.stop="toggleMenu(transaction.id)"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>

                    <div
                      v-if="openMenuId === transaction.id"
                      class="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-10"
                      role="menu"
                      @click.stop
                    >
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); openViewModal(transaction)"
                      >
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {{ t('view') }}
                      </button>
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); openEditModal(transaction)"
                      >
                        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {{ t('update') }}
                      </button>
                      <button
                        class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        role="menuitem"
                        @click="closeMenu(); handleDelete(transaction.id)"
                      >
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {{ t('delete') }}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="paybackTransactions.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ t('no_transactions_title') }}
          </div>
          <div v-if="paybackTotalPages > 1" class="flex items-center justify-center gap-1.5 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              :disabled="paybackPage === 1"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                paybackPage === 1
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="paybackPage--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <template v-for="p in paybackVisiblePages" :key="p">
              <span v-if="p === '...'" class="w-10 h-10 flex items-center justify-center text-sm text-gray-400">…</span>
              <button
                v-else
                :class="[
                  'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                  p === paybackPage
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                ]"
                @click="paybackPage = p"
              >{{ p }}</button>
            </template>

            <button
              :disabled="paybackPage === paybackTotalPages"
              :class="[
                'w-10 h-10 flex items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                paybackPage === paybackTotalPages
                  ? 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-white dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              ]"
              @click="paybackPage++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Add/Edit Modal -->
    <BaseModal :show="showModal" :title="t('add_borrow_payback')" @close="closeModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Type Selection -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            type="button"
            :class="[
              'py-2 px-4 rounded-md font-medium transition-colors',
              form.type === 'borrow'
                ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="form.type = 'borrow'"
          >
            {{ t('borrow') }}
          </button>
          <button
            type="button"
            :class="[
              'py-2 px-4 rounded-md font-medium transition-colors',
              form.type === 'payback'
                ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="form.type = 'payback'"
          >
            {{ t('payback') }}
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Name -->
          <BaseInput
            v-model="form.name"
            :label="t('name')"
            :placeholder="t('name_placeholder')"
          />

          <!-- Amount -->
          <BaseInput
            v-model="form.amount"
            type="number"
            :label="form.type === 'borrow' ? t('borrow_amount') : t('payback_amount')"
            placeholder="0.00"
            :required="true"
          />
        </div>

        <!-- Description -->
        <BaseInput
          v-model="form.description"
          :label="t('description')"
          :placeholder="t('description_placeholder')"
        />

        <!-- Date -->
        <BaseInput
          v-model="form.date"
          type="date"
          :label="t('date')"
          :required="true"
        />

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <BaseButton type="button" variant="secondary" @click="closeModal" full-width>
            {{ t('cancel') }}
          </BaseButton>
          <BaseButton type="submit" :disabled="!isValid" full-width>
            {{ isEditing ? t('update') : t('add') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :show="showViewModal" :title="t('transaction_details')" @close="showViewModal = false">
      <div v-if="viewingTransaction" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('name') }}</div>
            <div class="font-medium text-gray-900 dark:text-white truncate">
              {{ viewingTransaction.name || '—' }}
            </div>
          </div>
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('date') }}</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ formatDate(viewingTransaction.date) }}</div>
          </div>
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('amount') }}</div>
            <div :class="[
              'font-semibold',
              viewingTransaction.type === 'borrow' ? 'text-green-600' : 'text-red-600'
            ]">
              {{ formatCurrency(viewingTransaction.amount) }}
            </div>
          </div>
          <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('category') }}</div>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ viewingTransaction.type === 'borrow' ? t('borrow') : t('payback') }}
            </div>
          </div>
        </div>

        <div v-if="viewingTransaction.description" class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('description') }}</div>
          <div class="text-gray-900 dark:text-white whitespace-pre-wrap">{{ viewingTransaction.description }}</div>
        </div>

        <BaseButton variant="secondary" full-width @click="showViewModal = false">{{ t('cancel') }}</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
