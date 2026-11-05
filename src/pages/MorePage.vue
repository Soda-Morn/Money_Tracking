<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { PiggyBank, HandCoins, Target, Tags, Settings, LogOut, ChevronRight, CalendarClock } from 'lucide-vue-next'
import AppIcon from '../components/ui/AppIcon.vue'
import { useAuth } from '../composables/useAuth'
import { useFormat } from '../composables/useFormat'
import { useSavingsGoals } from '../composables/useSavingsGoals'
import { useLoans } from '../composables/useLoans'

const router = useRouter()
const { t } = useI18n()
const { currentUser, logout } = useAuth()
const { formatCurrency } = useFormat()
const { totalSaved, goals } = useSavingsGoals()
const { activeLoanCount } = useLoans()

const userInitials = computed(() => {
  const name = currentUser.value?.displayName || currentUser.value?.email || '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

// Right-hand hints reuse values the app already computes — display only.
const groups = computed(() => [
  {
    title: t('nav.section_money'),
    items: [
      { to: '/planner', icon: CalendarClock, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
        label: t('nav.planner'), desc: t('more.planner_desc'), hint: '' },
      { to: '/savings', icon: PiggyBank, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        label: t('nav.savings'), desc: t('more.savings_desc'), hint: goals.value.length ? formatCurrency(totalSaved.value) : '' },
      { to: '/loans', icon: HandCoins, tint: 'bg-tertiary-50 text-tertiary-600 dark:bg-tertiary-900/30 dark:text-tertiary-300',
        label: t('nav.borrow'), desc: t('more.loans_desc'), hint: activeLoanCount.value ? t('more.active_count', { n: activeLoanCount.value }) : '' },
      { to: '/settings/budget', icon: Target, tint: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300',
        label: t('nav.budgets'), desc: t('more.budgets_desc'), hint: '' },
    ],
  },
  {
    title: t('nav.section_manage'),
    items: [
      { to: '/settings/categories', icon: Tags, tint: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-300',
        label: t('nav.categories'), desc: t('more.categories_desc'), hint: '' },
      { to: '/settings', icon: Settings, tint: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
        label: t('nav.settings'), desc: t('more.settings_desc'), hint: '' },
    ],
  },
])

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>

<template>
  <div class="space-y-6 max-w-xl mx-auto">
    <h1 class="hidden lg:block text-2xl font-bold text-gray-900 dark:text-white">{{ t('nav.more') }}</h1>

    <!-- Profile -->
    <section class="reveal flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <div class="w-12 h-12 bg-primary-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">
        {{ userInitials }}
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-gray-900 dark:text-white truncate">{{ currentUser?.displayName || t('user') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ currentUser?.email }}</p>
      </div>
    </section>

    <!-- Destinations -->
    <section v-for="(group, gi) in groups" :key="group.title" class="reveal" :style="{ '--i': gi + 1 }">
      <h2 class="px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ group.title }}</h2>
      <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        <router-link
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3.5 px-4 min-h-[64px] py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
        >
          <span :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', item.tint]">
            <AppIcon :icon="item.icon" size="button" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-[15px] font-semibold text-gray-900 dark:text-white truncate">{{ item.label }}</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.desc }}</span>
          </span>
          <span v-if="item.hint" class="tabular text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">{{ item.hint }}</span>
          <AppIcon :icon="ChevronRight" size="action" class="text-gray-300 dark:text-gray-600" />
        </router-link>
      </div>
    </section>

    <button
      type="button"
      class="reveal pressable w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20"
      :style="{ '--i': 3 }"
      @click="handleLogout"
    >
      <AppIcon :icon="LogOut" size="action" />{{ t('sign_out') }}
    </button>
  </div>
</template>
