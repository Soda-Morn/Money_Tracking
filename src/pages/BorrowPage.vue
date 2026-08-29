<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTransactions } from '../composables/useTransactions'
import { useFormat } from '../composables/useFormat'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BorrowForm from '../components/transactions/BorrowForm.vue'
import PersonLedgerModal from '../components/transactions/PersonLedgerModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import MobileFAB from '../components/ui/MobileFAB.vue'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const toast = useToast()
const { transactions, addTransaction, updateTransaction, deleteTransaction, totalBorrow, totalPayback } = useTransactions()
const { formatCurrency } = useFormat()

const borrowTransactions = computed(() => transactions.value.filter(t => t.type === 'borrow'))
const paybackTransactions = computed(() => transactions.value.filter(t => t.type === 'payback'))

// Reuse the canonical totals already computed by useTransactions() rather
// than re-deriving the same sums here.
const totalBorrowed = totalBorrow
const totalPaidBack = totalPayback

// ── Active Balances (one row per person) ──────────────────────────────────────
const personSummary = computed(() => {
  const map = {}
  borrowTransactions.value.forEach(t => {
    const name = (t.name || '').trim()
    if (!name) return
    if (!map[name]) map[name] = { name, borrowed: 0, paid: 0 }
    map[name].borrowed += Number(t.amount)
  })
  paybackTransactions.value.forEach(t => {
    const name = (t.name || '').trim()
    if (!name) return
    if (!map[name]) map[name] = { name, borrowed: 0, paid: 0 }
    map[name].paid += Number(t.amount)
  })
  return Object.values(map)
    .map(p => ({ ...p, net: p.borrowed - p.paid }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
})

// Net across everyone at once — the at-a-glance "total owed to me" figure
const netAcrossAll = computed(() => personSummary.value.reduce((s, p) => s + p.net, 0))

// Name filter — search across people once the list grows
const filterName = ref('')
const filteredPersonSummary = computed(() => {
  const q = filterName.value.trim().toLowerCase()
  if (!q) return personSummary.value
  return personSummary.value.filter(p => p.name.toLowerCase().includes(q))
})

// ── Person ledger modal ────────────────────────────────────────────────────────
const showLedgerModal = ref(false)
const selectedPersonName = ref('')

const openLedger = (name) => {
  selectedPersonName.value = name
  showLedgerModal.value = true
}

// Combine the already-filtered borrow/payback arrays instead of re-scanning
// the full transaction history (which includes unrelated income/expense rows).
const personLedgerTransactions = computed(() => {
  if (!selectedPersonName.value) return []
  return [...borrowTransactions.value, ...paybackTransactions.value].filter(
    t => (t.name || '').trim() === selectedPersonName.value
  )
})

// ── Add/Edit modal ─────────────────────────────────────────────────────────────
const showFormModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const formInitialData = ref({})
// Whether the form was opened from inside the ledger modal — if so, closing
// the form should return the user to that ledger instead of the bare list.
const cameFromLedger = ref(false)

const openAddModal = (prefillName = '') => {
  cameFromLedger.value = !!prefillName
  formInitialData.value = prefillName ? { type: 'borrow', name: prefillName } : { type: 'borrow' }
  isEditing.value = false
  editingId.value = null
  showLedgerModal.value = false
  showFormModal.value = true
}

const openEditModal = (transaction) => {
  cameFromLedger.value = true
  formInitialData.value = { ...transaction }
  isEditing.value = true
  editingId.value = transaction.id
  showLedgerModal.value = false
  showFormModal.value = true
}

const closeFormModal = () => {
  showFormModal.value = false
  if (cameFromLedger.value) showLedgerModal.value = true
  cameFromLedger.value = false
}

const handleFormSubmit = async (data) => {
  if (isEditing.value && editingId.value) {
    await updateTransaction(editingId.value, data)
    toast.success(t('toast_record_updated'))
  } else {
    await addTransaction(data)
    toast.success(t('toast_record_added'))
  }
  closeFormModal()
}

// ── Delete confirmation ────────────────────────────────────────────────────────
const showDeleteDialog = ref(false)
const deletingId = ref(null)
const deletingName = ref('')

const requestDelete = (id, name) => {
  deletingId.value = id
  deletingName.value = name || ''
  showLedgerModal.value = false
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (deletingId.value) {
    await deleteTransaction(deletingId.value)
    toast.success(t('toast_record_deleted'))
  }
  showDeleteDialog.value = false
  deletingId.value = null
  deletingName.value = ''
}

const cancelDelete = () => {
  showDeleteDialog.value = false
  deletingId.value = null
  deletingName.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('pages.borrow') }}</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">{{ t('track_income_expenses') }}</p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-4">
      <BaseCard>
        <p class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('total_borrowed') }}</p>
        <p class="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">{{ formatCurrency(totalBorrowed) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('total_paid_back') }}</p>
        <p class="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 truncate">{{ formatCurrency(totalPaidBack) }}</p>
      </BaseCard>
    </div>

    <!-- Add Record -->
    <button
      class="hidden sm:block w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm"
      @click="openAddModal()"
    >
      + {{ t('add_borrow_payback') }}
    </button>

    <!-- Name Filter -->
    <div v-if="personSummary.length > 0" class="relative max-w-xs">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
      <input
        v-model="filterName"
        type="text"
        :placeholder="t('filter_by_name')"
        class="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button
        v-if="filterName"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        @click="filterName = ''"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Active Balances -->
    <BaseCard padding="p-0">
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-gray-900 dark:text-white shrink-0">{{ t('active_balances') }}</span>
          <span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full shrink-0">{{ filteredPersonSummary.length }}</span>
        </div>
        <span
          v-if="netAcrossAll !== 0"
          class="text-xs font-bold shrink-0"
          :class="netAcrossAll > 0 ? 'text-amber-500' : 'text-green-600'"
        >{{ netAcrossAll > 0 ? t('owes_you') : t('you_owe') }} {{ formatCurrency(Math.abs(netAcrossAll)) }}</span>
      </div>

      <EmptyState v-if="filteredPersonSummary.length === 0" :title="t('no_transactions_title')" icon="folder" />
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <button
          v-for="person in filteredPersonSummary"
          :key="person.name"
          class="w-full px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left flex items-center justify-between gap-3"
          @click="openLedger(person.name)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {{ person.name.charAt(0).toUpperCase() }}
            </div>
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ person.name }}</p>
          </div>
          <div class="text-right shrink-0">
            <span
              v-if="person.net === 0"
              class="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            >{{ t('settled') }}</span>
            <template v-else>
              <p class="text-sm font-bold" :class="person.net > 0 ? 'text-amber-500' : 'text-green-600'">
                {{ formatCurrency(Math.abs(person.net)) }}
              </p>
              <p class="text-xs" :class="person.net > 0 ? 'text-amber-400' : 'text-green-500'">
                {{ person.net > 0 ? t('owes_you') : t('you_owe') }}
              </p>
            </template>
          </div>
        </button>
      </div>
    </BaseCard>

    <!-- Person Ledger Modal -->
    <PersonLedgerModal
      :show="showLedgerModal"
      :person-name="selectedPersonName"
      :transactions="personLedgerTransactions"
      @close="showLedgerModal = false"
      @edit="openEditModal"
      @delete="requestDelete"
      @add-record="openAddModal"
    />

    <!-- Add/Edit Modal -->
    <BaseModal :show="showFormModal" :title="t('add_borrow_payback')" @close="closeFormModal">
      <BorrowForm
        :initial-data="formInitialData"
        :is-editing="isEditing"
        @submit="handleFormSubmit"
        @cancel="closeFormModal"
      />
    </BaseModal>

    <!-- Mobile FAB -->
    <MobileFAB @click="openAddModal()" />

    <!-- Delete Confirmation Dialog -->
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
                <template v-if="deletingName">
                  {{ t('delete_confirm_name', { name: deletingName }) }}
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
