<script setup>
/**
 * Budgets: two clear tabs instead of one long page of forms.
 *  - Monthly         month switcher, how much is left, category budgets
 *  - Daily & weekly  spending limits with alerts
 * Every add / edit happens in the same bottom sheet (BudgetSheet).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CalendarDays, Gauge } from 'lucide-vue-next'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import MonthlyBudget from '../components/budget/MonthlyBudget.vue'
import SpendingLimits from '../components/budget/SpendingLimits.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Tab lives in the URL (?tab=limits) so Back and the dashboard link land on the right one
const tab = computed({
  get: () => (route.query.tab === 'limits' ? 'limits' : 'monthly'),
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'limits' ? 'limits' : undefined } }),
})
const tabs = computed(() => [
  { value: 'monthly', label: t('budget_page.tab_monthly'), icon: CalendarDays },
  { value: 'limits', label: t('budget_page.tab_limits'), icon: Gauge },
])
</script>

<template>
  <div class="space-y-4 max-w-2xl mx-auto animate-fade-in">
    <header>
      <h1 class="hidden lg:block text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{{ t('budget_page.title') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 lg:mt-1">{{ t('budget_page.subtitle') }}</p>
    </header>

    <SegmentedControl v-model="tab" :options="tabs" :label="t('budget_page.subtitle')" />

    <KeepAlive>
      <MonthlyBudget v-if="tab === 'monthly'" />
      <SpendingLimits v-else />
    </KeepAlive>
  </div>
</template>
