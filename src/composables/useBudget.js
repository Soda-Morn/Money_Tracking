import { ref } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth } from '../firebase'
import { db } from '../firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { normalizeBudgets } from '../shared/finance'

/**
 * Budget data shape (per month):
 *   budgets[monthKey] = { total: number, categories: { [categoryValue]: number } }
 *   e.g. { "2026-03": { total: 500, categories: { food: 100, transport: 50 } } }
 *
 * Backward-compat: legacy entries where the value is a plain number are
 * silently promoted to the new shape by `normalize()` on load.
 */

// Module-level singleton — shared across all composable instances
const budgets = ref({})
let currentUid = null

/** Promote any legacy { [key]: number } entries to the full object shape. */
// Shared with the Telegram Worker (src/shared/finance.js)
const normalize = normalizeBudgets

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'budgets'))
      if (snap.exists()) budgets.value = normalize(snap.data())
    } catch (e) {
      console.error('[budget] load failed:', e)
    }
  } else {
    currentUid = null
    budgets.value = {}
  }
})

async function persist() {
  if (!currentUid) return
  try {
    await setDoc(doc(db, 'users', currentUid, 'settings', 'budgets'), budgets.value)
  } catch (error) {
    console.error('[budget] persist failed:', error)
    throw error
  }
}

export function useBudget() {
  /** Set (or update) the total budget for a month; preserves existing category limits. */
  const setBudget = async (monthKey, total) => {
    const existing = budgets.value[monthKey] ?? { total: 0, categories: {} }
    budgets.value = { ...budgets.value, [monthKey]: { ...existing, total: Number(total) } }
    await persist()
  }

  /** Set a spending limit for one category within a month. */
  const setCategoryBudget = async (monthKey, categoryValue, amount) => {
    const existing = budgets.value[monthKey] ?? { total: 0, categories: {} }
    budgets.value = {
      ...budgets.value,
      [monthKey]: {
        ...existing,
        categories: { ...existing.categories, [categoryValue]: Number(amount) }
      }
    }
    await persist()
  }

  /** Remove the spending limit for one category within a month. */
  const removeCategoryBudget = async (monthKey, categoryValue) => {
    const existing = budgets.value[monthKey]
    if (!existing) return
    const { [categoryValue]: _removed, ...rest } = existing.categories ?? {}
    budgets.value = { ...budgets.value, [monthKey]: { ...existing, categories: rest } }
    await persist()
  }

  /** Remove the entire budget entry for a month. */
  const removeBudget = async (monthKey) => {
    const { [monthKey]: _removed, ...rest } = budgets.value
    budgets.value = rest
    await persist()
  }

  return { budgets, setBudget, setCategoryBudget, removeCategoryBudget, removeBudget }
}
