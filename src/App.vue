<script setup>
import { ref, watch } from 'vue'
import { useAuth } from './composables/useAuth'
import { useTheme } from './composables/useTheme'
import { useUserPreferences } from './composables/useUserPreferences'
import Navbar from './components/layout/Navbar.vue'
import MobileNav from './components/layout/MobileNav.vue'
import MobileHeader from './components/layout/MobileHeader.vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const { currentUser, authLoading } = useAuth()
// Initialize theme on app start (applies saved dark/light class to <html>)
useTheme()
// Sync theme + locale with Firebase so they restore after clearing app data
useUserPreferences()

// Smooth fade when language switches
const isFading = ref(false)
watch(locale, () => {
  isFading.value = true
  setTimeout(() => { isFading.value = false }, 200)
})
</script>

<template>
  <!-- Auth state loading splash -->
  <div v-if="authLoading" class="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-xl mb-2">
        <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
      <p class="text-sm text-white/70 font-medium tracking-wide">{{ t('loading') }}</p>
    </div>
  </div>

  <template v-else>
    <!-- Authenticated: show full app layout -->
    <div v-if="currentUser" class="min-h-screen bg-slate-100 dark:bg-gray-950">
      <Navbar />
      <MobileHeader />
      <main class="lg:pl-64 lg:pb-0 main-mobile-pb" :class="{ 'locale-fading': isFading }">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <router-view v-slot="{ Component }">
            <transition name="page" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
      <MobileNav />
    </div>

    <!-- Unauthenticated: show auth page (no layout chrome) -->
    <router-view v-else />
  </template>
</template>

<style scoped>
.main-mobile-pb {
  padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 1024px) {
  .main-mobile-pb {
    padding-bottom: 2rem;
  }
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Smooth fade when switching language */
main {
  transition: opacity 0.2s ease;
}
main.locale-fading {
  opacity: 0;
}
</style>
