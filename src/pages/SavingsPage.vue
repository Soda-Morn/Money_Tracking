<script setup>
import { ref, computed } from 'vue'
import { useSavingsGoals } from '../composables/useSavingsGoals'
import { useFormat } from '../composables/useFormat'
import GoalCard from '../components/savings/GoalCard.vue'
import GoalForm from '../components/savings/GoalForm.vue'
import AddMoneyForm from '../components/savings/AddMoneyForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const {
  goals,
  addGoal,
  updateGoal,
  deleteGoal,
  addToGoal,
  totalSaved,
  totalTarget,
  completedGoals
} = useSavingsGoals()

const { formatCurrency } = useFormat()

const showAddModal = ref(false)
const showEditModal = ref(false)
const showAddMoneyModal = ref(false)
const editingGoal = ref(null)
const selectedGoal = ref(null)

const overallProgress = computed(() => {
  if (totalTarget.value === 0) return 0
  return (totalSaved.value / totalTarget.value) * 100
})

const handleAdd = (data) => {
  addGoal(data)
  showAddModal.value = false
}

const handleEdit = (goal) => {
  editingGoal.value = goal
  showEditModal.value = true
}

const handleUpdate = (data) => {
  updateGoal(editingGoal.value.id, data)
  showEditModal.value = false
  editingGoal.value = null
}

const handleDelete = (id) => {
  if (confirm('Are you sure you want to delete this goal?')) {
    deleteGoal(id)
  }
}

const handleAddMoney = (goal) => {
  selectedGoal.value = goal
  showAddMoneyModal.value = true
}

const handleAddMoneySubmit = (amount) => {
  addToGoal(selectedGoal.value.id, amount)
  showAddMoneyModal.value = false
  selectedGoal.value = null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Savings Goals</h1>
        <p class="text-gray-500 mt-1">Track your savings and reach your goals</p>
      </div>
      <BaseButton @click="showAddModal = true">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        New Goal
      </BaseButton>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <BaseCard>
        <p class="text-sm text-gray-500 mb-1">Total Saved</p>
        <p class="text-2xl font-bold text-blue-600">{{ formatCurrency(totalSaved) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-sm text-gray-500 mb-1">Total Target</p>
        <p class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalTarget) }}</p>
      </BaseCard>
      <BaseCard>
        <p class="text-sm text-gray-500 mb-1">Completed Goals</p>
        <p class="text-2xl font-bold text-green-600">{{ completedGoals }} / {{ goals.length }}</p>
      </BaseCard>
    </div>

    <!-- Overall Progress -->
    <BaseCard v-if="goals.length > 0">
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-medium text-gray-900">Overall Progress</h3>
        <span class="text-sm text-gray-500">{{ Math.round(overallProgress) }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div
          class="bg-blue-600 h-3 rounded-full transition-all duration-500"
          :style="{ width: `${Math.min(100, overallProgress)}%` }"
        ></div>
      </div>
    </BaseCard>

    <!-- Goals Grid -->
    <div v-if="goals.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <GoalCard
        v-for="goal in goals"
        :key="goal.id"
        :goal="goal"
        @edit="handleEdit"
        @delete="handleDelete"
        @add-money="handleAddMoney"
      />
    </div>

    <!-- Empty State -->
    <BaseCard v-else>
      <EmptyState
        title="No savings goals yet"
        description="Create your first savings goal to start tracking your progress"
        icon="target"
      >
        <BaseButton @click="showAddModal = true">
          Create Your First Goal
        </BaseButton>
      </EmptyState>
    </BaseCard>

    <!-- Add Goal Modal -->
    <BaseModal
      :show="showAddModal"
      title="Create Savings Goal"
      @close="showAddModal = false"
    >
      <GoalForm
        @submit="handleAdd"
        @cancel="showAddModal = false"
      />
    </BaseModal>

    <!-- Edit Goal Modal -->
    <BaseModal
      :show="showEditModal"
      title="Edit Savings Goal"
      @close="showEditModal = false"
    >
      <GoalForm
        v-if="editingGoal"
        :initial-data="editingGoal"
        :is-editing="true"
        @submit="handleUpdate"
        @cancel="showEditModal = false"
      />
    </BaseModal>

    <!-- Add Money Modal -->
    <BaseModal
      :show="showAddMoneyModal"
      title="Add Money to Goal"
      @close="showAddMoneyModal = false"
    >
      <AddMoneyForm
        v-if="selectedGoal"
        :goal="selectedGoal"
        @submit="handleAddMoneySubmit"
        @cancel="showAddMoneyModal = false"
      />
    </BaseModal>
  </div>
</template>
