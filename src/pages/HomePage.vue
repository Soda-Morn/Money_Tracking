<script setup>
import { ref } from 'vue'
import { useTransactions } from '../composables/useTransactions'
import SummaryCards from '../components/transactions/SummaryCards.vue'
import TransactionList from '../components/transactions/TransactionList.vue'
import TransactionForm from '../components/transactions/TransactionForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const {
  transactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  totalIncome,
  totalExpense,
  totalBalance
} = useTransactions()

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

    <!-- Summary Cards -->
    <SummaryCards
      :total-income="totalIncome"
      :total-expense="totalExpense"
      :total-balance="totalBalance"
    />

    <!-- Transactions List -->
    <BaseCard>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        <span class="text-sm text-gray-500">{{ transactions.length }} total</span>
      </div>
      <TransactionList
        :transactions="transactions"
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
