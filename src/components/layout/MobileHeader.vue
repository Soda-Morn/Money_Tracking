<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from 'vue-i18n'
import { Wallet, LogOut, Settings } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const { currentUser, logout } = useAuth()
const { t } = useI18n()
const showMenu = ref(false)

const pageTitle = computed(() => {
  if (route.path.startsWith('/loans/')) return t('loan_details_title')
  const titles = {
    '/':                  t('pages.dashboard'),
    '/activity':          t('nav.transactions'),
    '/savings':           t('pages.savings'),
    '/analytics':         t('nav.reports'),
    '/more':              t('nav.more'),
    '/planner':           t('planner.title'),
    '/settings':          t('pages.settings'),
    '/settings/categories': t('pages.categories'),
    '/settings/budget':     t('pages.budget'),
    '/loans':             t('pages.borrow'),
  }
  return titles[route.path] || 'FinanceFlow'
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
  <header class="lg:hidden sticky top-0 z-30 bg-[#f5f7f7]/95 dark:bg-[#0a1613]/95 header-safe-top">
    <div class="flex items-center justify-between h-14 pl-4 pr-2">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
          <AppIcon :icon="Wallet" size="action" class="text-white" />
        </div>
        <h1 class="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight truncate">{{ pageTitle }}</h1>
      </div>

      <!-- Account menu (44px tap target) -->
      <button
        type="button"
        class="w-11 h-11 flex items-center justify-center rounded-full"
        :aria-label="t('account')"
        :aria-expanded="showMenu ? 'true' : 'false'"
        aria-haspopup="menu"
        @click="showMenu = !showMenu"
      >
        <span class="pressable w-9 h-9 bg-primary-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
          {{ userInitials }}
        </span>
      </button>
    </div>

    <Transition name="menu">
      <div v-if="showMenu" class="absolute top-full inset-x-0 px-3 pt-1 z-50">
        <div class="fixed inset-0 -z-10" @click="showMenu = false"></div>
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/10 border border-gray-100 dark:border-gray-800 p-2" role="menu">
          <div class="flex items-center gap-3 p-3">
            <div class="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {{ userInitials }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ currentUser?.displayName || t('user') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ currentUser?.email }}</p>
            </div>
          </div>
          <router-link
            to="/settings"
            role="menuitem"
            class="w-full flex items-center gap-3 px-3 h-11 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-sm font-medium"
            @click="showMenu = false"
          >
            <AppIcon :icon="Settings" size="action" class="text-gray-400" />{{ t('settings') }}
          </router-link>
          <button
            type="button"
            role="menuitem"
            class="w-full flex items-center gap-3 px-3 h-11 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm font-medium"
            @click="handleLogout"
          >
            <AppIcon :icon="LogOut" size="action" />{{ t('sign_out') }}
          </button>
        </div>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.header-safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s ease, transform 0.18s var(--ease-out);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
