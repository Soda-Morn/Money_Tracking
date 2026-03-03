import { ref } from 'vue'
import { auth } from '../firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'

// ── Module-level singleton state (shared across all composable calls) ──────────
const currentUser = ref(null)
const authLoading = ref(true)

onAuthStateChanged(auth, (user) => {
  currentUser.value = user
    ? { uid: user.uid, email: user.email, displayName: user.displayName }
    : null
  authLoading.value = false
})

// ── Error message mapping ──────────────────────────────────────────────────────
function getErrorMessage(code) {
  const map = {
    'auth/invalid-credential':      'Invalid email or password.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/email-already-in-use':    'This email is already registered.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/operation-not-allowed':   'Email/Password sign-in is not enabled. Please contact support.',
  }
  return map[code] || `Something went wrong (${code}). Please try again.`
}

// ── Composable ─────────────────────────────────────────────────────────────────
export function useAuth() {
  const error = ref(null)
  const loading = ref(false)

  const register = async (name, email, password) => {
    error.value = null
    loading.value = true
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: name })
      // Force update reactive state with displayName
      currentUser.value = { uid: user.uid, email: user.email, displayName: name }
    } catch (e) {
      error.value = getErrorMessage(e.code)
    } finally {
      loading.value = false
    }
  }

  const login = async (email, password) => {
    error.value = null
    loading.value = true
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      error.value = getErrorMessage(e.code)
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  return { currentUser, authLoading, error, loading, register, login, logout }
}
