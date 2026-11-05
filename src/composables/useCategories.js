import { ref, computed } from 'vue'
import { auth } from '../firebase'
import { db } from '../firestore'
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// Built-in categories live in src/shared/categories.js (also used by the Telegram Worker)
import { defaultExpenseCategories, defaultIncomeCategories } from '../shared/categories'
export { defaultExpenseCategories, defaultIncomeCategories }

// Module-level singleton state — shared across all composable instances
const customCategories = ref([])
let unsubscribe = null

onAuthStateChanged(auth, (user) => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }

  if (user) {
    const colRef = collection(db, 'users', user.uid, 'categories')
    unsubscribe = onSnapshot(colRef, (snap) => {
      customCategories.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }, (error) => {
      console.error('[categories] listener error:', error)
    })
  } else {
    customCategories.value = []
  }
})

export function useCategories() {
  // Only user-created categories — no defaults shown in lists
  const expenseCategories = computed(() =>
    customCategories.value.filter(c => c.type === 'expense')
  )

  const incomeCategories = computed(() =>
    customCategories.value.filter(c => c.type === 'income')
  )

  // Returns { icon, label } for a given category value + transaction type
  const getCategoryInfo = (categoryValue, type) => {
    const list = type === 'expense'
      ? [...defaultExpenseCategories, ...customCategories.value.filter(c => c.type === 'expense')]
      : [...defaultIncomeCategories, ...customCategories.value.filter(c => c.type === 'income')]
    return list.find(c => c.value === categoryValue) || { icon: 'tag', label: categoryValue }
  }

  const addCategory = async ({ type, label, icon }) => {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Not authenticated')
    // Generate a unique value key from the label
    const base = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const value = `${base}_${Date.now()}`
    try {
      await addDoc(collection(db, 'users', uid, 'categories'), {
        type,
        label,
        icon,
        value,
        createdAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('[categories] addCategory failed:', error)
      throw error
    }
  }

  const deleteCategory = async (id) => {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Not authenticated')
    try {
      await deleteDoc(doc(db, 'users', uid, 'categories', id))
    } catch (error) {
      console.error('[categories] deleteCategory failed:', error)
      throw error
    }
  }

  return {
    expenseCategories,
    incomeCategories,
    customCategories,
    getCategoryInfo,
    addCategory,
    deleteCategory
  }
}
