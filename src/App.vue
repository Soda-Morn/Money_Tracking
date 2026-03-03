<script setup>
import { useAuth } from './composables/useAuth'
import Navbar from './components/layout/Navbar.vue'
import MobileNav from './components/layout/MobileNav.vue'
import MobileHeader from './components/layout/MobileHeader.vue'

const { currentUser, authLoading } = useAuth()
</script>

<template>
  <!-- Auth state loading splash -->
  <div v-if="authLoading" class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="flex flex-col items-center gap-3">
      <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400">Loading…</p>
    </div>
  </div>

  <template v-else>
    <!-- Authenticated: show full app layout -->
    <div v-if="currentUser" class="min-h-screen bg-gray-100">
      <Navbar />
      <MobileHeader />
      <main class="lg:pl-64 lg:pb-0 main-mobile-pb">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
    padding-bottom: 0;
  }
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
