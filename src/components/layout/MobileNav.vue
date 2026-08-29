<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

const navItems = computed(() => [
  { name: t('nav.home'),      path: '/',          icon: 'dashboard' },
  { name: t('nav.activity'),  path: '/activity',  icon: 'activity'  },
  { name: t('nav.savings'),   path: '/savings',   icon: 'savings'   },
  { name: t('nav.borrow'),    path: '/loans',     icon: 'loans'     },
  { name: t('nav.analytics'), path: '/analytics', icon: 'chart'     },
])

// Also match nested routes (e.g. /loans/:id should keep the Loans tab active)
const isActive = (path) => route.path === path || route.path.startsWith(path + '/')
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
                ? 'bg-primary-600 shadow-md shadow-primary-500/30'
                : ''
            ]"
          >
            <!-- Dashboard -->
            <svg v-if="item.icon === 'dashboard'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke-width="2" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke-width="2" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke-width="2" />
              <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke-width="2" />
            </svg>
            <!-- Activity -->
            <svg v-else-if="item.icon === 'activity'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h4l2.5 7 4-14 2.5 7H21" />
            </svg>
            <!-- Savings -->
            <svg v-else-if="item.icon === 'savings'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <!-- Chart -->
            <svg v-else-if="item.icon === 'chart'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <!-- Loans -->
            <svg v-else-if="item.icon === 'loans'" class="w-5 h-5" :class="isActive(item.path) ? 'text-white' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>

          <span
            :class="[
              'text-[10px] font-semibold leading-none transition-colors duration-200',
              isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
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
