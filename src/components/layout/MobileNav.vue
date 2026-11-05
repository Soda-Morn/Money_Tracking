<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { House, ArrowLeftRight, ChartPie, LayoutGrid, Plus } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useQuickAdd } from '../../composables/useQuickAdd'

const route = useRoute()
const { t } = useI18n()
const { open: openQuickAdd } = useQuickAdd()

// `match` lists every route prefix that should light up the tab.
// Savings, Loans, Budgets, Categories and Settings live under "More".
const left = computed(() => [
  { name: t('nav.home'), path: '/', icon: House, match: ['/'] },
  { name: t('nav.transactions'), path: '/activity', icon: ArrowLeftRight, match: ['/activity'] },
])
const right = computed(() => [
  { name: t('nav.reports'), path: '/analytics', icon: ChartPie, match: ['/analytics'] },
  { name: t('nav.more'), path: '/more', icon: LayoutGrid, match: ['/more', '/planner', '/savings', '/loans', '/settings'] },
])

const isActive = (item) => item.match.some(p =>
  p === '/' ? route.path === '/' : route.path === p || route.path.startsWith(p + '/')
)

// Plain Tailwind classes (with dark: variants) so both themes get correct contrast.
const itemClass = (item) => isActive(item)
  ? 'text-primary-700 dark:text-primary-200'
  : 'text-gray-500 dark:text-gray-400'
const pillClass = (item) => isActive(item)
  ? 'bg-primary-100 dark:bg-primary-800/70'
  : 'bg-transparent'
</script>

<template>
  <nav
    class="lg:hidden fixed bottom-0 inset-x-0 z-40 nav-safe-bottom bg-white/[0.97] dark:bg-gray-900/[0.97] border-t border-gray-200/70 dark:border-gray-800/70"
    :aria-label="t('main_navigation')"
  >
    <div class="grid grid-cols-5 items-end h-16 max-w-md mx-auto px-1">
      <router-link
        v-for="item in left"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="itemClass(item)"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <span class="nav-pill" :class="pillClass(item)"><AppIcon :icon="item.icon" size="nav" /></span>
        <span class="nav-label">{{ item.name }}</span>
      </router-link>

      <!-- Primary action: add a transaction from anywhere, in thumb reach -->
      <div class="flex justify-center">
        <button
          type="button"
          class="pressable -mt-5 mb-2 w-14 h-14 rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-700/30 ring-4 ring-white dark:ring-gray-900 flex items-center justify-center hover:bg-primary-700"
          :aria-label="t('add_transaction')"
          @click="openQuickAdd('expense')"
        >
          <AppIcon :icon="Plus" size="card" :stroke-width="2.25" />
        </button>
      </div>

      <router-link
        v-for="item in right"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="itemClass(item)"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <span class="nav-pill" :class="pillClass(item)"><AppIcon :icon="item.icon" size="nav" /></span>
        <span class="nav-label">{{ item.name }}</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Full-height tap area (≥ 44px) with icon pill + label */
.nav-item {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-base) ease;
}

.nav-pill {
  width: 3rem;
  height: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  transition: background-color var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.nav-item:active .nav-pill { transform: scale(0.92); }

.nav-label {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
</style>
