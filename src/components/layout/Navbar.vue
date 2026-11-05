<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from 'vue-i18n'
import {
  House, ArrowLeftRight, ChartPie, PiggyBank, HandCoins, Target, Tags, CalendarClock,
  Settings, LogOut, Wallet, Plus,
} from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useQuickAdd } from '../../composables/useQuickAdd'

const route = useRoute()
const router = useRouter()
const { currentUser, logout } = useAuth()
const { t } = useI18n()
const { open: openQuickAdd } = useQuickAdd()

// Same destinations as the mobile bottom bar + "More" page, grouped for scanning.
const sections = computed(() => [
  {
    title: t('nav.section_overview'),
    items: [
      { name: t('nav.home'), path: '/', icon: House },
      { name: t('nav.transactions'), path: '/activity', icon: ArrowLeftRight },
      { name: t('nav.reports'), path: '/analytics', icon: ChartPie },
    ],
  },
  {
    title: t('nav.section_money'),
    items: [
      { name: t('nav.planner'), path: '/planner', icon: CalendarClock },
      { name: t('nav.savings'), path: '/savings', icon: PiggyBank },
      { name: t('nav.borrow'), path: '/loans', icon: HandCoins },
      { name: t('nav.budgets'), path: '/settings/budget', icon: Target },
    ],
  },
  {
    title: t('nav.section_manage'),
    items: [
      { name: t('nav.categories'), path: '/settings/categories', icon: Tags },
      { name: t('nav.settings'), path: '/settings', icon: Settings, exact: true },
    ],
  },
])

// Nested routes keep their parent active (/loans/:id → Loans). Settings is
// exact so it doesn't light up alongside Budgets/Categories.
const isActive = (item) => {
  if (item.path === '/' || item.exact) return route.path === item.path
  return route.path === item.path || route.path.startsWith(item.path + '/')
}

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
  <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0b1714] text-white z-30" :aria-label="t('main_navigation')">
    <!-- Brand -->
    <div class="flex items-center gap-3 h-16 px-5">
      <div class="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
        <AppIcon :icon="Wallet" size="nav" class="text-white" />
      </div>
      <span class="text-[15px] font-bold tracking-tight">Finance<span class="text-primary-400">Flow</span></span>
    </div>

    <!-- Primary action -->
    <div class="px-3 pb-2">
      <button
        type="button"
        class="pressable w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-sm font-semibold text-white shadow-lg shadow-black/20"
        @click="openQuickAdd('expense')"
      >
        <AppIcon :icon="Plus" size="button" />{{ t('add_transaction') }}
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-3 space-y-5">
      <div v-for="section in sections" :key="section.title">
        <p class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{{ section.title }}</p>
        <div class="space-y-0.5">
          <router-link
            v-for="item in section.items"
            :key="item.path"
            :to="item.path"
            :aria-current="isActive(item) ? 'page' : undefined"
            :class="[
              'relative flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors duration-200',
              isActive(item)
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            ]"
          >
            <span
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary-400 transition-all duration-200"
              :class="isActive(item) ? 'h-5 opacity-100' : 'h-0 opacity-0'"
            />
            <AppIcon :icon="item.icon" size="nav" :class="isActive(item) ? 'text-primary-300' : ''" />
            <span class="truncate">{{ item.name }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Account -->
    <div class="p-3 border-t border-white/5">
      <div class="flex items-center gap-3 min-w-0 px-2 py-2">
        <div class="w-9 h-9 bg-primary-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
          {{ userInitials }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white truncate leading-tight">
            {{ currentUser?.displayName || t('user') }}
          </p>
          <p class="text-xs text-gray-500 truncate mt-0.5">{{ currentUser?.email }}</p>
        </div>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          :title="t('sign_out')"
          :aria-label="t('sign_out')"
          @click="handleLogout"
        >
          <AppIcon :icon="LogOut" size="action" />
        </button>
      </div>
      <p class="text-center text-[10px] text-gray-600 mt-1 tracking-wide select-none">
        Made by <span class="text-primary-400 font-semibold">Soda MORN</span>
      </p>
    </div>
  </aside>
</template>
