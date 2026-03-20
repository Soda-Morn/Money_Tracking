import { watch, nextTick } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './useAuth'
import { useTheme } from './useTheme'
import { useI18n } from 'vue-i18n'
import { useCurrency } from './useCurrency'

export function useUserPreferences() {
  const { currentUser } = useAuth()
  const { isDark } = useTheme()
  const { locale } = useI18n()
  const { currency } = useCurrency()

  const prefsRef = (uid) => doc(db, 'users', uid, 'settings', 'preferences')

  // Prevent write-back loop when we are loading from Firestore
  let isSyncing = false

  // ── Load from Firestore when user logs in ─────────────────────────────────
  watch(currentUser, async (user) => {
    if (!user?.uid) return
    try {
      const snap = await getDoc(prefsRef(user.uid))
      if (!snap.exists()) return

      isSyncing = true
      const { theme, locale: savedLocale, currency: savedCurrency } = snap.data()

      if (theme) {
        isDark.value = theme === 'dark'
        document.documentElement.classList.toggle('dark', isDark.value)
        localStorage.setItem('theme', theme)
      }
      if (savedLocale) {
        locale.value = savedLocale
        localStorage.setItem('locale', savedLocale)
      }
      if (savedCurrency) {
        currency.value = savedCurrency
        localStorage.setItem('currency', savedCurrency)
      }

      await nextTick()
    } catch (e) {
      console.error('[preferences] load failed:', e)
    } finally {
      isSyncing = false
    }
  }, { immediate: true })

  // ── Save theme to Firestore whenever it changes ───────────────────────────
  watch(isDark, async (val) => {
    if (isSyncing || !currentUser.value?.uid) return
    try {
      await setDoc(prefsRef(currentUser.value.uid), { theme: val ? 'dark' : 'light' }, { merge: true })
    } catch (e) {
      console.error('[preferences] save theme failed:', e)
    }
  })

  // ── Save locale to Firestore whenever it changes ──────────────────────────
  watch(locale, async (val) => {
    if (isSyncing || !currentUser.value?.uid) return
    try {
      await setDoc(prefsRef(currentUser.value.uid), { locale: val }, { merge: true })
    } catch (e) {
      console.error('[preferences] save locale failed:', e)
    }
  })

  // ── Save currency to Firestore whenever it changes ────────────────────────
  watch(currency, async (val) => {
    if (isSyncing || !currentUser.value?.uid) return
    try {
      await setDoc(prefsRef(currentUser.value.uid), { currency: val }, { merge: true })
    } catch (e) {
      console.error('[preferences] save currency failed:', e)
    }
  })
}
