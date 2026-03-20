import { ref } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Module-level singleton
const budgets = ref({}) // { [categoryValue]: amountUSD }
let currentUid = null

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'budgets'))
      if (snap.exists()) budgets.value = snap.data()
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
  await setDoc(doc(db, 'users', currentUid, 'settings', 'budgets'), budgets.value)
}

export function useBudget() {
  const setBudget = async (category, amount) => {
    budgets.value = { ...budgets.value, [category]: Number(amount) }
    await persist()
  }

  const removeBudget = async (category) => {
    const { [category]: _removed, ...rest } = budgets.value
    budgets.value = rest
    await persist()
  }

  return { budgets, setBudget, removeBudget }
}
