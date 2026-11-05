<script setup>
import { defineAsyncComponent } from 'vue'
import { useAuth, SIGNED_IN_HINT } from './composables/useAuth'
import { useTheme } from './composables/useTheme'
import BootSplash from './components/layout/BootSplash.vue'

const { currentUser, authLoading } = useAuth()
// Initialize theme on app start (applies saved dark/light class to <html>)
useTheme()

// The signed-in shell (navigation, pages, Firestore) is a separate chunk, so
// the login page stays light. Returning users start downloading it right
// away — in parallel with Firebase restoring the session — so they don't wait
// any longer than before.
const loadShell = () => import('./components/layout/AppShell.vue')
try {
  if (localStorage.getItem(SIGNED_IN_HINT) === '1') loadShell()
} catch { /* storage unavailable — loads on demand instead */ }

const AppShell = defineAsyncComponent({ loader: loadShell, loadingComponent: BootSplash, delay: 0 })
</script>

<template>
  <!-- Auth state loading splash -->
  <BootSplash v-if="authLoading" />

  <!-- Authenticated: full app layout (own chunk) -->
  <AppShell v-else-if="currentUser" />

  <!-- Unauthenticated: show auth page (no layout chrome) -->
  <router-view v-else />
</template>
