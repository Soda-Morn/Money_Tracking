<script setup>
/**
 * Daily & weekly tab: two clear sections (Per day · Per week), each limit a
 * tappable row with today's / this week's usage. Same sheet as monthly budgets.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, BellRing, Sun, CalendarRange } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import BudgetRow from './BudgetRow.vue'
import BudgetSheet from './BudgetSheet.vue'
import { useSpendingLimits } from '../../composables/useSpendingLimits'
import { useCategories, defaultExpenseCategories } from '../../composables/useCategories'
import { useToast } from '../../composables/useToast'
import { useLimitText } from './useLimitText'

const { t } = useI18n()
const toast = useToast()
const { limits, allRows, today, savePeriod } = useSpendingLimits()
const { rangeText, inactiveText } = useLimitText()
const statusOrder = { active: 0, upcoming: 1, ended: 2 }
const { expenseCategories } = useCategories()

const allCats = computed(() => [...defaultExpenseCategories, ...expenseCategories.value])
const info = (scope) => (scope === 'total'
  ? { label: t('limits.total'), icon: 'wallet' }
  : allCats.value.find((c) => c.value === scope) ?? { label: scope, icon: 'tag' })

const sections = computed(() => [
  { period: 'day', title: t('limits.per_day'), desc: t('budget_page.day_desc'), icon: Sun },
  { period: 'week', title: t('limits.per_week'), desc: t('budget_page.week_desc'), icon: CalendarRange },
].map((s) => ({
  ...s,
  // Counting today first; then "All spending", then closest to the limit
  rows: allRows.value.filter((r) => r.period === s.period)
    .sort((a, b) => (statusOrder[a.status] - statusOrder[b.status])
      || (a.scope === 'total' ? -1 : b.scope === 'total' ? 1 : b.pct - a.pct)),
})))

// ── Sheet ────────────────────────────────────────────────────────────────────
const sheet = ref({ show: false, period: 'day', scope: null }) // scope null = adding
const saving = ref(false)

// Options for "add": everything not yet limited in the chosen period.
// (The sheet's own Day/Week switch decides the period, so offer the union and validate on save.)
const options = computed(() => [
  { value: 'total', label: t('limits.total_option'), icon: 'wallet' },
  ...allCats.value.map((c) => ({ value: c.value, label: c.label, icon: c.icon })),
])
const sheetProps = computed(() => {
  const s = sheet.value
  if (s.scope) {
    const i = info(s.scope)
    const cur = limits.value[s.period]
    return {
      title: s.period === 'day' ? t('budget_page.edit_day_limit') : t('budget_page.edit_week_limit'),
      hint: '', fixed: { label: i.label, icon: i.icon }, options: [], periods: false, period: s.period,
      amount: s.scope === 'total' ? cur.total : cur.categories[s.scope] ?? null, canDelete: true,
      withDates: true, range: cur.dates[s.scope] || null, today: today.value,
    }
  }
  return {
    title: t('budget_page.add_limit'), hint: t('budget_page.add_limit_hint'), fixed: null, options: options.value,
    periods: true, period: s.period, amount: null, canDelete: false, withDates: true, range: null, today: today.value,
  }
})

const open = (period, scope = null) => { sheet.value = { show: true, period, scope } }
const close = () => { sheet.value = { ...sheet.value, show: false } }

async function write(period, mutate, okMsg) {
  const cur = limits.value[period]
  const next = { total: cur.total, categories: { ...cur.categories }, dates: { ...cur.dates } }
  mutate(next)
  saving.value = true
  try {
    await savePeriod(period, next)
    toast.success(okMsg)
    close()
  } catch (e) {
    console.error('[limits] save failed:', e)
    toast.error(t('toast_save_error'))
  } finally {
    saving.value = false
  }
}

function onSave({ scope, amount, period, range }) {
  const s = sheet.value
  const p = s.scope ? s.period : period
  const target = s.scope || scope
  return write(p, (n) => {
    if (target === 'total') n.total = amount; else n.categories[target] = amount
    if (range) n.dates[target] = range; else delete n.dates[target]
  }, t('limits.saved'))
}
function onDelete() {
  const { period, scope } = sheet.value
  return write(period, (n) => {
    if (scope === 'total') n.total = null; else delete n.categories[scope]
    delete n.dates[scope]
  }, t('limits.removed'))
}
</script>

<template>
  <div class="space-y-4">
    <!-- What this is, in one line -->
    <div class="flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 px-4 py-3">
      <AppIcon :icon="BellRing" size="action" class="shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
      <p class="text-sm">{{ t('budget_page.limits_intro') }}</p>
    </div>

    <section
      v-for="s in sections"
      :key="s.period"
      class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden"
    >
      <header class="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
            <AppIcon :icon="s.icon" size="action" />
          </span>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ s.title }}</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ s.desc }}</p>
          </div>
        </div>
        <button
          type="button"
          class="pressable shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
          @click="open(s.period)"
        >
          <AppIcon :icon="Plus" size="xs" />{{ t('add') }}
        </button>
      </header>

      <div v-if="s.rows.length" class="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
        <BudgetRow
          v-for="r in s.rows"
          :key="r.scope"
          :label="info(r.scope).label"
          :icon="info(r.scope).icon"
          :spent="r.spent"
          :limit="r.limit"
          :note="rangeText(r)"
          :inactive="inactiveText(r)"
          @edit="open(s.period, r.scope)"
        />
      </div>
      <button
        v-else
        type="button"
        class="w-[calc(100%-2rem)] mx-4 mb-4 py-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        @click="open(s.period)"
      >
        {{ s.period === 'day' ? t('limits.empty_day') : t('limits.empty_week') }}
      </button>
    </section>

    <BudgetSheet
      :show="sheet.show"
      v-bind="sheetProps"
      :saving="saving"
      @close="close"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
