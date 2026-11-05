<script setup>
/**
 * Dashboard card: today's and this week's spending limits.
 * Shows what's left for every limit counting today (with its dates, if any),
 * the next limit that starts later, or a small prompt when none are set.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Gauge, ChevronRight, Plus, CalendarClock } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import LimitProgress from './LimitProgress.vue'
import { useSpendingLimits } from '../../composables/useSpendingLimits'
import { useCategories } from '../../composables/useCategories'
import { useFormat } from '../../composables/useFormat'
import { useLimitText } from './useLimitText'

const { t } = useI18n()
const { usage, allRows, enabled, loaded } = useSpendingLimits()
const { getCategoryInfo } = useCategories()
const { formatCurrency } = useFormat()
const { rangeText, short } = useLimitText()

const nameOf = (r) => (r.scope === 'total' ? t('limits.total') : getCategoryInfo(r.scope, 'expense').label)
const when = (r) => (r.period === 'day' ? t('limits.today') : t('limits.this_week'))

// Closest to breaking first; max 4 rows
const rows = computed(() => [...usage.value]
  .sort((a, b) => b.pct - a.pct)
  .slice(0, 4)
  .map((r) => ({
    ...r,
    label: `${nameOf(r)} · ${when(r)}`,
    note: rangeText(r),
    icon: r.scope === 'total' ? '' : getCategoryInfo(r.scope, 'expense').icon,
  })))
const hidden = computed(() => Math.max(0, usage.value.length - rows.value.length))

// Next limit that hasn't started yet (e.g. "Food $10/day from Nov 20")
const upcoming = computed(() => allRows.value
  .filter((r) => r.status === 'upcoming')
  .sort((a, b) => a.from.localeCompare(b.from))[0] || null)
</script>

<template>
  <!-- Limits set -->
  <router-link
    v-if="loaded && enabled"
    to="/settings/budget?tab=limits"
    class="pressable block rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 hover:border-gray-200 dark:hover:border-gray-700"
  >
    <div class="flex items-center gap-2.5 mb-3">
      <span class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
        <AppIcon :icon="Gauge" size="button" />
      </span>
      <h2 class="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{{ t('limits.summary_title') }}</h2>
      <span class="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400">
        {{ t('limits.manage') }}<AppIcon :icon="ChevronRight" size="xs" />
      </span>
    </div>
    <div v-if="rows.length" class="space-y-3">
      <LimitProgress v-for="r in rows" :key="r.period + r.scope" :row="r" :label="r.label" :icon="r.icon" :note="r.note" />
      <p v-if="hidden" class="text-xs text-gray-400 dark:text-gray-500">{{ t('budget_page.n_more', { count: hidden }) }}</p>
    </div>
    <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('budget_page.none_today') }}</p>
    <p v-if="upcoming" class="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <AppIcon :icon="CalendarClock" size="xs" class="shrink-0" />
      <span class="truncate">{{ t('budget_page.next_limit', { name: nameOf(upcoming), amount: formatCurrency(upcoming.limit), per: upcoming.period === 'day' ? t('budget_page.a_day') : t('budget_page.a_week'), date: short(upcoming.from) }) }}</span>
    </p>
  </router-link>

  <!-- No limits yet: small prompt so the feature is easy to find -->
  <router-link
    v-else-if="loaded"
    to="/settings/budget?tab=limits"
    class="pressable flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 p-4 hover:border-primary-300 dark:hover:border-primary-700"
  >
    <span class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
      <AppIcon :icon="Gauge" size="button" />
    </span>
    <span class="flex-1 min-w-0">
      <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('budget_page.cta_title') }}</span>
      <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('budget_page.cta_desc') }}</span>
    </span>
    <AppIcon :icon="Plus" size="action" class="text-primary-600 dark:text-primary-400 shrink-0" />
  </router-link>
</template>
