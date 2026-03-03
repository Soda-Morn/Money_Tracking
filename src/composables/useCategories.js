import { ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

export const defaultExpenseCategories = [
  { value: 'food', label: 'Food & Dining', icon: '🍔', isDefault: true },
  { value: 'transport', label: 'Transportation', icon: '🚗', isDefault: true },
  { value: 'shopping', label: 'Shopping', icon: '🛍️', isDefault: true },
  { value: 'bills', label: 'Bills & Utilities', icon: '📄', isDefault: true },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬', isDefault: true },
  { value: 'health', label: 'Health', icon: '🏥', isDefault: true },
  { value: 'education', label: 'Education', icon: '📚', isDefault: true },
  { value: 'other', label: 'Other', icon: '📌', isDefault: true }
]

export const defaultIncomeCategories = [
  { value: 'salary', label: 'Salary', icon: '💼', isDefault: true },
  { value: 'freelance', label: 'Freelance', icon: '💻', isDefault: true },
  { value: 'investment', label: 'Investment', icon: '📈', isDefault: true },
  { value: 'gift', label: 'Gift', icon: '🎁', isDefault: true },
  { value: 'other', label: 'Other', icon: '📌', isDefault: true }
]

// Module-level singleton state — shared across all composable instances
const customCategories = ref([])
let unsubscribe = null

onAuthStateChanged(auth, (user) => {
  if (user && !unsubscribe) {
    const colRef = collection(db, 'users', user.uid, 'categories')
    unsubscribe = onSnapshot(colRef, (snap) => {
      customCategories.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  } else if (!user) {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    customCategories.value = []
  }
})

export function useCategories() {
  const expenseCategories = computed(() => [
    ...defaultExpenseCategories,
    ...customCategories.value.filter(c => c.type === 'expense')
  ])

  const incomeCategories = computed(() => [
    ...defaultIncomeCategories,
    ...customCategories.value.filter(c => c.type === 'income')
  ])

  // Returns { icon, label } for a given category value + transaction type
  const getCategoryInfo = (categoryValue, type) => {
    const list = type === 'expense'
      ? [...defaultExpenseCategories, ...customCategories.value.filter(c => c.type === 'expense')]
      : [...defaultIncomeCategories, ...customCategories.value.filter(c => c.type === 'income')]
    return list.find(c => c.value === categoryValue) || { icon: '📌', label: categoryValue }
  }

  const addCategory = async ({ type, label, icon }) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    // Generate a unique value key from the label
    const base = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const value = `${base}_${Date.now()}`
    await addDoc(collection(db, 'users', uid, 'categories'), {
      type,
      label,
      icon,
      value,
      createdAt: new Date().toISOString()
    })
  }

  const deleteCategory = async (id) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'categories', id))
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
