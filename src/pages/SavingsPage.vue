<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavingsGoals } from '../composables/useSavingsGoals'
import { useFormat } from '../composables/useFormat'
import GoalCard from '../components/savings/GoalCard.vue'
import GoalForm from '../components/savings/GoalForm.vue'
import AddMoneyForm from '../components/savings/AddMoneyForm.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import MobileFAB from '../components/ui/MobileFAB.vue'

// translation helper
const { t } = useI18n()

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
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('savings') }}</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">{{ t('track_savings_desc') }}</p>
    </div>

    <MobileFAB @click="showAddModal = true" />

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <!-- Total Saved — gradient hero -->
      <div class="relative overflow-hidden col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 rounded-2xl p-4 shadow-lg shadow-blue-500/25">
        <div class="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
        <p class="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1.5">{{ t('total_saved') }}</p>
        <p class="text-xl font-bold text-white tracking-tight">{{ formatCurrency(totalSaved) }}</p>
      </div>
      <!-- Total Target -->
      <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800/80 shadow-sm">
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{{ t('total_target') }}</p>
        <p class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{{ formatCurrency(totalTarget) }}</p>
      </div>
      <!-- Completed Goals -->
      <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800/80 shadow-sm">
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{{ t('completed_goals') }}</p>
        <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{{ completedGoals }} <span class="text-gray-400 dark:text-gray-600 font-medium text-base">/ {{ goals.length }}</span></p>
      </div>
    </div>

    <!-- Overall Progress -->
    <BaseCard v-if="goals.length > 0">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-semibold text-gray-900 dark:text-white">{{ t('overall_progress') }}</h3>
        <span class="text-sm font-bold text-blue-600 dark:text-blue-400">{{ Math.round(overallProgress) }}%</span>
      </div>
      <div class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <div
          class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-700 ease-out shadow-sm shadow-blue-400/30"
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
        :title="t('no_savings_goals_title')"
        :description="t('no_savings_goals_desc')"
        icon="target"
      >
        <BaseButton @click="showAddModal = true">
          {{ t('create_first_goal') }}
        </BaseButton>
      </EmptyState>
    </BaseCard>

    <!-- Add Goal Modal -->
    <BaseModal
      :show="showAddModal"
      :title="t('create_savings_goal')"
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
      :title="t('edit_savings_goal')"
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
      :title="t('add_money_goal')"
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
