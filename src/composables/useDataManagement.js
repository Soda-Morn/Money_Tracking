import { db, auth } from '../firebase'
import {
  collection, doc, getDocs, writeBatch, setDoc
} from 'firebase/firestore'
import { useTransactions } from './useTransactions'
import { useSavingsGoals } from './useSavingsGoals'
import { useCategories } from './useCategories'
import { useBudget } from './useBudget'

const BATCH_LIMIT = 500 // Firestore max ops per batch

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function csvEscape(value) {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

// Run `items` through `fn` in Firestore batches of BATCH_LIMIT ops.
async function runInBatches(items, fn) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const chunk = items.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    chunk.forEach(item => fn(batch, item))
    await batch.commit()
  }
}

export function useDataManagement() {
  const { transactions } = useTransactions()
  const { goals } = useSavingsGoals()
  const { customCategories } = useCategories()
  const { budgets } = useBudget()

  const uid = () => auth.currentUser?.uid

  // ── CSV export (transactions only — the data users most often want in a spreadsheet) ──
  const exportCsv = () => {
    const header = ['Date', 'Type', 'Category', 'Name', 'Description', 'Amount']
    const rows = [...transactions.value]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map(t => [t.date, t.type, t.category || '', t.name || '', t.description || '', t.amount])
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
    downloadBlob(`financeflow-transactions-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8;')
  }

  // ── Full JSON backup — everything needed to fully restore an account ──────────
  const backupJson = () => {
    const payload = {
      app: 'FinanceFlow',
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: transactions.value,
      goals: goals.value,
      categories: customCategories.value,
      budgets: budgets.value,
    }
    downloadBlob(`financeflow-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  // ── JSON restore — merges the backup's records into the current account ───────
  const restoreJson = async (file) => {
    const id = uid()
    if (!id) throw new Error('Not signed in')

    const text = await file.text()
    const payload = JSON.parse(text)

    if (Array.isArray(payload.transactions) && payload.transactions.length) {
      await runInBatches(payload.transactions, (batch, tx) => {
        const { id: _drop, ...data } = tx
        batch.set(doc(collection(db, 'users', id, 'transactions')), data)
      })
    }
    if (Array.isArray(payload.goals) && payload.goals.length) {
      await runInBatches(payload.goals, (batch, goal) => {
        const { id: _drop, ...data } = goal
        batch.set(doc(collection(db, 'users', id, 'goals')), data)
      })
    }
    if (Array.isArray(payload.categories) && payload.categories.length) {
      await runInBatches(payload.categories, (batch, cat) => {
        const { id: _drop, ...data } = cat
        batch.set(doc(collection(db, 'users', id, 'categories')), data)
      })
    }
    if (payload.budgets && typeof payload.budgets === 'object') {
      await setDoc(doc(db, 'users', id, 'settings', 'budgets'), payload.budgets, { merge: true })
    }
  }

  // ── Reset all data — irreversible wipe of the current user's financial records ─
  const resetAllData = async () => {
    const id = uid()
    if (!id) throw new Error('Not signed in')

    for (const name of ['transactions', 'goals', 'categories']) {
      const snap = await getDocs(collection(db, 'users', id, name))
      const ids = snap.docs.map(d => d.id)
      await runInBatches(ids, (batch, docId) => {
        batch.delete(doc(db, 'users', id, name, docId))
      })
    }
    await setDoc(doc(db, 'users', id, 'settings', 'budgets'), {})
  }

  return { exportCsv, backupJson, restoreJson, resetAllData }
}
