<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { currentUser, logout } = useAuth()

const showMenu = ref(false)

const pageTitle = computed(() => {
  const titles = {
    '/': 'Dashboard',
    '/savings': 'Savings Goals',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/settings/categories': 'Categories'
  }
  return titles[route.path] || 'Money Tracking'
})

const userInitials = computed(() => {
  const name = currentUser.value?.displayName || currentUser.value?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

const handleLogout = async () => {
  showMenu.value = false
  await logout()
  router.push('/login')
}
</script>

<template>
  <!-- Mobile Header -->
  <header class="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between h-14 px-4">
      <!-- Left: logo + page title -->
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span class="text-base font-bold text-gray-900 dark:text-white">{{ pageTitle }}</span>
      </div>

      <!-- Right: user avatar button -->
      <button
        class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold"
        @click="showMenu = !showMenu"
      >
        {{ userInitials }}
      </button>
    </div>

    <!-- User dropdown menu -->
    <Transition name="menu">
      <div
        v-if="showMenu"
        class="absolute top-14 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-md z-50"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 -z-10" @click="showMenu = false"></div>

        <div class="px-4 py-3">
          <!-- User info -->
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {{ userInitials }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ currentUser?.displayName || 'User' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ currentUser?.email }}</p>
            </div>
          </div>

          <!-- Sign out button -->
          <button
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30 rounded-xl transition-colors text-sm font-medium"
            @click="handleLogout"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
