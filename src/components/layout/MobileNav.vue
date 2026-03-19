<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

const navItems = computed(() => [
  { name: t('nav.home'),      path: '/',          icon: 'home'     },
  { name: t('nav.savings'),   path: '/savings',   icon: 'savings'  },
  { name: t('nav.analytics'), path: '/analytics', icon: 'chart'    },
  { name: t('nav.borrow'),    path: '/borrow',    icon: 'borrow'   },
  { name: t('nav.settings'),  path: '/settings',  icon: 'settings' },
])

const isActive = (path) => route.path === path
</script>

<template>
  <!-- Mobile Bottom Navigation -->
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 nav-safe-bottom bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 shadow-xl shadow-black/10 dark:shadow-black/30">
      <div class="flex justify-around items-center h-16 px-2">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-all duration-200 relative"
        >
          <!-- Icon container with active background -->
          <div
            :class="[
              'w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-200',
              isActive(item.path)
                ? 'bg-blue-600 shadow-md shadow-blue-500/30'
                : ''
            ]"
          >
            <!-- Home -->
            <svg v-if="item.icon === 'home'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <!-- Savings -->
            <svg v-else-if="item.icon === 'savings'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <!-- Chart -->
            <svg v-else-if="item.icon === 'chart'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <!-- Borrow -->
            <svg v-else-if="item.icon === 'borrow'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <!-- Settings -->
            <svg v-else-if="item.icon === 'settings'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <span
            :class="[
              'text-[10px] font-semibold leading-none transition-colors duration-200',
              isActive(item.path) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
            ]"
          >{{ item.name }}</span>
        </router-link>
      </div>
  </nav>
</template>

<style scoped>
.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
