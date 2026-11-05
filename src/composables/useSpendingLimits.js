import { ref, computed, watch } from 'vue'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { db } from '../firestore'
import { useTransactions } from './useTransactions'
import { toLocalDateString } from './useFormat'
import { normalizeLimits, hasAnyLimit, limitUsage, pendingAlerts, alertKey, pruneAlertKeys } from '../shared/limits'

/**
 * Daily & weekly spending limits (users/{uid}/settings/spendingLimits).
 * Rules live in src/shared/limits.js — shared with the Telegram bot.
 */
const raw = ref(null)
const loaded = ref(false)
let unsub = null

onAuthStateChanged(auth, (user) => {
  unsub?.()
  unsub = null
  raw.value = null
  loaded.value = false
  if (!user) return
  unsub = onSnapshot(doc(db, 'users', user.uid, 'settings', 'spendingLimits'), (snap) => {
    raw.value = snap.exists() ? snap.data() : null
    loaded.value = true
  }, (e) => {
    console.error('[limits] listener error:', e)
    loaded.value = true
  })
})

// "Today" ticks so a session left open past midnight / Monday rolls over
const today = ref(toLocalDateString(new Date()))
if (typeof window !== 'undefined') setInterval(() => { today.value = toLocalDateString(new Date()) }, 60_000)

export function useSpendingLimits() {
  const { transactions } = useTransactions()
  const limits = computed(() => normalizeLimits(raw.value))
  // Active limits only (dashboard, alerts) …
  const usage = computed(() => limitUsage(raw.value, transactions.value, today.value))
  // … and every limit incl. upcoming / ended ones (the editor)
  const allRows = computed(() => limitUsage(raw.value, transactions.value, today.value, { includeInactive: true }))
  const enabled = computed(() => hasAnyLimit(limits.value))

  /**
   * Replace one period's limits ({ total, categories, dates }).
   * Writes the WHOLE doc (no merge): a merge would keep nested keys, so a
   * removed category limit or date range would silently survive.
   */
  async function savePeriod(period, { total, categories, dates = {} }) {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Not authenticated')
    const next = { ...limits.value, [period]: { total: Number(total) > 0 ? Number(total) : null, categories, dates } }
    await setDoc(doc(db, 'users', uid, 'settings', 'spendingLimits'), {
      day: next.day,
      week: next.week,
      updatedAt: new Date().toISOString(),
    })
  }

  return { limits, usage, allRows, enabled, loaded, today, savePeriod }
}

/**
 * In-app alerts at 80 % / 100 % — call ONCE (AppShell). Each limit alerts at
 * most once per level per day/week on this device (remembered in localStorage,
 * which only stores alert keys — never amounts).
 */
export function useLimitAlerts(notify) {
  const { usage, loaded } = useSpendingLimits()
  const storageKey = () => `ff:limitAlertsShown:${auth.currentUser?.uid || ''}`
  const read = () => { try { return JSON.parse(localStorage.getItem(storageKey()) || '[]') } catch { return [] } }
  const write = (keys) => { try { localStorage.setItem(storageKey(), JSON.stringify(keys)) } catch { /* optional */ } }

  watch(usage, (rows) => {
    if (!loaded.value || !auth.currentUser) return
    const shown = read()
    const fresh = pendingAlerts(rows, shown)
    if (!fresh.length) return
    fresh.forEach((row) => notify(row))
    write(pruneAlertKeys([...shown, ...fresh.map(alertKey)], today.value))
  })
}
