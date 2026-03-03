import { ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, query, orderBy
} from 'firebase/firestore'

// ── Module-level singleton ────────────────────────────────────────────────────
const goals = ref([])
const loading = ref(true)
let _unsubscribe = null

// Re-initialize the Firestore listener on every auth state change.
// This ensures data is cleared when a user logs out and reloaded for the new user.
onAuthStateChanged(auth, (user) => {
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }
  goals.value = []

  if (user) {
    loading.value = true
    const q = query(
      collection(db, 'users', user.uid, 'goals'),
      orderBy('createdAt', 'desc')
    )
    _unsubscribe = onSnapshot(q, (snapshot) => {
      goals.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    })
  } else {
    loading.value = false
  }
})

// ── Composable ────────────────────────────────────────────────────────────────
export function useSavingsGoals() {
  const uid = () => auth.currentUser?.uid

  const addGoal = async (goal) => {
    await addDoc(collection(db, 'users', uid(), 'goals'), {
      ...goal,
      currentAmount: goal.currentAmount || 0,
      createdAt: new Date().toISOString()
    })
  }

  const updateGoal = async (id, updates) => {
    await updateDoc(doc(db, 'users', uid(), 'goals', id), updates)
  }

  const deleteGoal = async (id) => {
    await deleteDoc(doc(db, 'users', uid(), 'goals', id))
  }

  const addToGoal = async (id, amount) => {
    const goal = goals.value.find(g => g.id === id)
    if (goal) {
      await updateDoc(doc(db, 'users', uid(), 'goals', id), {
        currentAmount: Number(goal.currentAmount) + Number(amount)
      })
    }
  }

  const getProgress = (goal) => {
    if (!goal.targetAmount || goal.targetAmount === 0) return 0
    return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
  }

  const totalSaved = computed(() =>
    goals.value.reduce((sum, g) => sum + Number(g.currentAmount), 0)
  )

  const totalTarget = computed(() =>
    goals.value.reduce((sum, g) => sum + Number(g.targetAmount), 0)
  )

  const completedGoals = computed(() =>
    goals.value.filter(g => g.currentAmount >= g.targetAmount).length
  )

  return {
    goals,
    loading,
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
