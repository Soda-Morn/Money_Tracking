<script setup>
/** Dashboard summary of planned expenses still to pay (never affects balances). */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarClock, ChevronRight, CircleAlert } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { usePlanner } from '../../composables/usePlanner'
import { useFormat, toLocalDateString } from '../../composables/useFormat'

const { t, locale } = useI18n()
const { formatCurrency } = useFormat()
const { plans, loading } = usePlanner()

const today = toLocalDateString(new Date())
const horizon = toLocalDateString(new Date(Date.now() + 30 * 86400000))

// Pending plans that are overdue or due within the next 30 days
const upcoming = computed(() => plans.value
  .filter((p) => p.status === 'pending' && p.dueDate <= horizon)
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
const total = computed(() => upcoming.value.reduce((s, p) => s + Number(p.amount || 0), 0))
const overdue = computed(() => upcoming.value.filter((p) => p.dueDate < today).length)
const next = computed(() => upcoming.value.find((p) => p.dueDate >= today) || upcoming.value[0])
const when = (d) => {
  if (d === today) return t('today')
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(locale.value || 'en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <router-link
    v-if="!loading && upcoming.length"
    to="/planner"
    class="pressable block rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 hover:border-gray-200 dark:hover:border-gray-700"
  >
    <div class="flex items-center gap-2.5">
      <span class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
        <AppIcon :icon="CalendarClock" size="button" />
      </span>
      <h2 class="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{{ t('planner.upcoming_title') }}</h2>
      <span class="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400">
        {{ t('view_all') }}<AppIcon :icon="ChevronRight" size="xs" />
      </span>
    </div>
    <div class="mt-3 flex items-baseline justify-between gap-2">
      <p class="tabular text-xl font-bold text-gray-900 dark:text-white truncate">{{ formatCurrency(total) }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ t('planner.n_payments', { count: upcoming.length }) }}</p>
    </div>
    <p v-if="next" class="mt-2 text-sm text-gray-600 dark:text-gray-300 truncate">
      {{ t('planner.next_due', { name: next.name, amount: formatCurrency(next.amount), date: when(next.dueDate) }) }}
    </p>
    <p v-if="overdue" class="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
      <AppIcon :icon="CircleAlert" size="xs" />{{ t('planner.n_overdue', { count: overdue }) }}
    </p>
  </router-link>
</template>
