import { ref, computed } from 'vue'
import { auth } from '../firebase'
import { db } from '../firestore'
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
// Data is only cleared on logout — not before the new listener connects — to prevent blank screens.
onAuthStateChanged(auth, (user) => {
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }

  if (user) {
    loading.value = true
    const q = query(
      collection(db, 'users', user.uid, 'goals'),
      orderBy('createdAt', 'desc')
    )
    _unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      // Empty on-device cache (first visit) ≠ "no goals": wait for the server
      if (snapshot.metadata.fromCache && snapshot.empty && navigator.onLine) return
      if (!loading.value && snapshot.docChanges().length === 0) return // metadata-only
      goals.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      loading.value = false
    }, (error) => {
      console.error('[goals] listener error:', error)
      loading.value = false
    })
  } else {
    goals.value = []
    loading.value = false
  }
})

// ── Composable ────────────────────────────────────────────────────────────────
export function useSavingsGoals() {
  const uid = () => auth.currentUser?.uid

  const addGoal = async (goal) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await addDoc(collection(db, 'users', currentUid, 'goals'), {
        ...goal,
        currentAmount: goal.currentAmount || 0,
        createdAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('[goals] addGoal failed:', error)
      throw error
    }
  }

  const updateGoal = async (id, updates) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await updateDoc(doc(db, 'users', currentUid, 'goals', id), updates)
    } catch (error) {
      console.error('[goals] updateGoal failed:', error)
      throw error
    }
  }

  const deleteGoal = async (id) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    try {
      await deleteDoc(doc(db, 'users', currentUid, 'goals', id))
    } catch (error) {
      console.error('[goals] deleteGoal failed:', error)
      throw error
    }
  }

  const addToGoal = async (id, amount) => {
    const currentUid = uid()
    if (!currentUid) throw new Error('Not authenticated')
    const goal = goals.value.find(g => g.id === id)
    if (goal) {
      try {
        await updateDoc(doc(db, 'users', currentUid, 'goals', id), {
          currentAmount: Number(goal.currentAmount) + Number(amount)
        })
      } catch (error) {
        console.error('[goals] addToGoal failed:', error)
        throw error
      }
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
