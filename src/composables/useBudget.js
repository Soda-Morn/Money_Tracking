import { ref } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Module-level singleton
// budgets: { [monthKey]: totalAmountUSD }  e.g. { "2026-03": 500, "2026-04": 800 }
const budgets = ref({})
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
  const setBudget = async (monthKey, total) => {
    budgets.value = { ...budgets.value, [monthKey]: Number(total) }
    await persist()
  }

  const removeBudget = async (monthKey) => {
    const { [monthKey]: _removed, ...rest } = budgets.value
    budgets.value = rest
    await persist()
  }

  return { budgets, setBudget, removeBudget }
}
