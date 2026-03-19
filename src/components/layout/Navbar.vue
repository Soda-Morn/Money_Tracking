<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { currentUser, logout } = useAuth()
const { t } = useI18n()

const navItems = computed(() => [
  { name: t('nav.home'),      path: '/',          icon: 'home'     },
  { name: t('nav.savings'),   path: '/savings',   icon: 'savings'  },
  { name: t('nav.analytics'), path: '/analytics', icon: 'chart'    },
  { name: t('nav.borrow'),    path: '/borrow',    icon: 'borrow'   },
  { name: t('nav.settings'),  path: '/settings',  icon: 'settings' },
])

const isActive = (path) => route.path === path

const userInitials = computed(() => {
  const name = currentUser.value?.displayName || currentUser.value?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>

<template>
  <!-- Desktop Sidebar Navigation -->
  <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0d1117] text-white overflow-hidden">

    <!-- Subtle gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-indigo-900/10 pointer-events-none"></div>

    <!-- Logo -->
    <div class="relative flex items-center h-16 px-5 border-b border-white/5">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <span class="text-sm font-bold tracking-tight text-white leading-none">Money</span>
          <span class="text-sm font-bold tracking-tight text-blue-400 leading-none"> Tracking</span>
        </div>
      </div>
    </div>

    <!-- Navigation Links -->
    <nav class="relative flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm group relative',
          isActive(item.path)
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-gray-400 hover:bg-white/6 hover:text-white'
        ]"
      >
        <!-- Active left glow -->
        <span
          v-if="isActive(item.path)"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/60 rounded-r-full"
        ></span>

        <!-- Home -->
        <svg v-if="item.icon === 'home'" class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <!-- Savings -->
        <svg v-else-if="item.icon === 'savings'" class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <!-- Chart -->
        <svg v-else-if="item.icon === 'chart'" class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <!-- Borrow -->
        <svg v-else-if="item.icon === 'borrow'" class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <!-- Settings -->
        <svg v-else-if="item.icon === 'settings'" class="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>

        <span>{{ item.name }}</span>
      </router-link>
    </nav>

    <!-- User card + Sign out -->
    <div class="relative p-3 border-t border-white/5">
      <!-- Glass user card -->
      <div class="bg-white/5 border border-white/8 rounded-2xl p-3 mb-2 backdrop-blur-sm">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-blue-500/20">
            {{ userInitials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-white truncate leading-tight">
              {{ currentUser?.displayName || t('user') }}
            </p>
            <p class="text-xs text-gray-500 truncate mt-0.5">{{ currentUser?.email }}</p>
          </div>
        </div>
      </div>

      <button
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-xl transition-all duration-200 text-sm font-medium"
        @click="handleLogout"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {{ t('sign_out') }}
      </button>
    </div>
  </aside>
</template>
