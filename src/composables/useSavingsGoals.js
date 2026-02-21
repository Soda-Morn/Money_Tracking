import { computed } from 'vue'
import { useStorage } from './useStorage'

/**
 * Composable for managing savings goals
 * Provides CRUD operations and progress tracking
 */
export function useSavingsGoals() {
  const goals = useStorage('money-tracking-goals', [])

  // Generate unique ID
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

  // Add new goal
  const addGoal = (goal) => {
    goals.value.unshift({
      id: generateId(),
      ...goal,
      currentAmount: goal.currentAmount || 0,
      createdAt: new Date().toISOString()
    })
  }

  // Update goal
  const updateGoal = (id, updates) => {
    const index = goals.value.findIndex(g => g.id === id)
    if (index !== -1) {
      goals.value[index] = { ...goals.value[index], ...updates }
    }
  }

  // Delete goal
  const deleteGoal = (id) => {
    const index = goals.value.findIndex(g => g.id === id)
    if (index !== -1) {
      goals.value.splice(index, 1)
    }
  }

  // Add money to goal
  const addToGoal = (id, amount) => {
    const goal = goals.value.find(g => g.id === id)
    if (goal) {
      goal.currentAmount = Number(goal.currentAmount) + Number(amount)
    }
  }

  // Calculate progress percentage
  const getProgress = (goal) => {
    if (!goal.targetAmount || goal.targetAmount === 0) return 0
    return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
  }

  // Total saved across all goals
  const totalSaved = computed(() => {
    return goals.value.reduce((sum, g) => sum + Number(g.currentAmount), 0)
  })

  // Total target across all goals
  const totalTarget = computed(() => {
    return goals.value.reduce((sum, g) => sum + Number(g.targetAmount), 0)
  })

  // Completed goals count
  const completedGoals = computed(() => {
    return goals.value.filter(g => g.currentAmount >= g.targetAmount).length
  })

  return {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    addToGoal,
    getProgress,
    totalSaved,
    totalTarget,
    completedGoals
  }
}
