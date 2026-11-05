import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { doc, onSnapshot, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore'
import { db } from '../firestore'
import { useAuth } from './useAuth'

/**
 * Telegram account linking — browser side.
 *
 * Connect: generate a random 192-bit code, store ONLY its SHA-256 hash in
 * telegramLinkCodes/{hash} with a 5-minute expiry, and hand the plain code to
 * Telegram via a t.me deep link. The Cloudflare Worker verifies + consumes it.
 *
 * Status: users/{uid}/settings/telegram is written by the Worker when linking
 * succeeds; deleting it here disconnects (the Worker re-checks it on every
 * message, so access stops immediately).
 *
 * No secrets live here — the bot username is public.
 */
export const LINK_CODE_TTL_MS = 5 * 60 * 1000
export const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || ''

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function useTelegramLink() {
  const { currentUser } = useAuth()
  const link = ref(null)          // { telegramUserId, username, firstName, linkedAt } | null
  const loading = ref(true)
  const pending = ref(null)       // { code, expiresAt }
  const now = ref(Date.now())
  let unsub = null
  let timer = null

  watch(() => currentUser.value?.uid, (uid) => {
    unsub?.()
    link.value = null
    if (!uid) return
    loading.value = true
    unsub = onSnapshot(
      doc(db, 'users', uid, 'settings', 'telegram'),
      (snap) => {
        link.value = snap.exists() ? snap.data() : null
        loading.value = false
        if (snap.exists()) pending.value = null // linked → hide the code
      },
      (err) => {
        console.error('[telegram] status listener error:', err)
        loading.value = false
      }
    )
  }, { immediate: true })

  const secondsLeft = computed(() =>
    pending.value ? Math.max(0, Math.ceil((pending.value.expiresAt - now.value) / 1000)) : 0
  )
  const deepLink = computed(() =>
    pending.value && BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=${pending.value.code}` : ''
  )

  const startTicking = () => {
    clearInterval(timer)
    timer = setInterval(() => {
      now.value = Date.now()
      if (pending.value && now.value >= pending.value.expiresAt) {
        pending.value = null
        clearInterval(timer)
      }
    }, 1000)
  }

  /** Create a fresh one-time code (throws on failure — caller shows a toast). */
  async function createCode() {
    const uid = currentUser.value?.uid
    if (!uid) throw new Error('Not authenticated')
    const code = base64url(crypto.getRandomValues(new Uint8Array(24))) // 32 chars, URL-safe
    const hash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))
    const expiresAt = Date.now() + LINK_CODE_TTL_MS
    await setDoc(doc(db, 'telegramLinkCodes', hash), {
      uid,
      expiresAt: Timestamp.fromMillis(expiresAt),
      createdAt: serverTimestamp(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    })
    pending.value = { code, expiresAt }
    now.value = Date.now()
    startTicking()
  }

  const cancelCode = () => { pending.value = null; clearInterval(timer) }

  async function disconnect() {
    const uid = currentUser.value?.uid
    if (!uid) throw new Error('Not authenticated')
    await deleteDoc(doc(db, 'users', uid, 'settings', 'telegram'))
  }

  onBeforeUnmount(() => { unsub?.(); clearInterval(timer) })

  return { link, loading, pending, secondsLeft, deepLink, createCode, cancelCode, disconnect }
}
