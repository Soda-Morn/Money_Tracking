<script setup>
/**
 * Everything that exists only for a signed-in user: navigation, pages, the
 * quick-add sheet, toasts and Firestore-backed preference sync. Loaded as its
 * own chunk (see App.vue) so the login page doesn't download the Firestore SDK.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserPreferences } from '../../composables/useUserPreferences'
import { useLimitAlerts } from '../../composables/useSpendingLimits'
import { useCategories } from '../../composables/useCategories'
import { useFormat } from '../../composables/useFormat'
import { useToast } from '../../composables/useToast'
import { prefetchMainRoutes } from '../../router'
import Navbar from './Navbar.vue'
import MobileNav from './MobileNav.vue'
import MobileHeader from './MobileHeader.vue'
import ToastContainer from '../ui/ToastContainer.vue'
import QuickAddSheet from '../transactions/QuickAddSheet.vue'

const { locale, t } = useI18n()

// Daily / weekly limit alerts (80 % and 100 %) — once per limit per level per period
const toast = useToast()
const { getCategoryInfo } = useCategories()
const { formatCurrency } = useFormat()
useLimitAlerts((row) => {
  const name = row.scope === 'total' ? t('limits.total') : getCategoryInfo(row.scope, 'expense').label
  const when = row.period === 'day' ? t('limits.today') : t('limits.this_week')
  const msg = row.level === 'over'
    ? t('limits.alert_over', { name, when, spent: formatCurrency(row.spent), limit: formatCurrency(row.limit) })
    : t('limits.alert_warn', { name, when, pct: row.pct, left: formatCurrency(row.remaining) })
  toast.show(msg, row.level === 'over' ? 'error' : 'info', 7000)
})

// Sync theme + locale + currency with Firebase so they restore after clearing app data
useUserPreferences()

// Warm up the main tabs in the background (idle time only)
prefetchMainRoutes()

// Smooth fade when language switches
const isFading = ref(false)
watch(locale, () => {
  isFading.value = true
  setTimeout(() => { isFading.value = false }, 200)
})
</script>

<template>
  <div class="min-h-screen bg-[#f5f7f7] dark:bg-[#0a1613]">
    <Navbar />
    <MobileHeader />
    <main class="lg:pl-64 lg:pb-0 main-mobile-pb" :class="{ 'locale-fading': isFading }">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-6 lg:py-8">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <MobileNav />
    <QuickAddSheet />
    <ToastContainer />
  </div>
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

/* The old page leaves instantly (it used to fade out for 200 ms BEFORE the new
   page could start, adding that delay to every navigation); the new page
   still fades in briefly. */
.page-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-leave-active {
  transition: none;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}

/* Smooth fade when switching language */
main {
  transition: opacity 0.2s ease;
}
main.locale-fading {
  opacity: 0;
}
</style>
