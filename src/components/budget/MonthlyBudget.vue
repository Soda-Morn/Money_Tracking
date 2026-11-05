<script setup>
/**
 * Monthly tab: month switcher → summary (spent / left / per-day tip) →
 * category budgets. Everything is edited in one bottom sheet.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Plus, Pencil, Wallet, Copy, CircleAlert, TriangleAlert, CircleCheck } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import BaseButton from '../ui/BaseButton.vue'
import BudgetRow from './BudgetRow.vue'
import BudgetSheet from './BudgetSheet.vue'
import { useBudget } from '../../composables/useBudget'
import { useTransactions } from '../../composables/useTransactions'
import { useCategories, defaultExpenseCategories } from '../../composables/useCategories'
import { useFormat, toLocalDateString } from '../../composables/useFormat'
import { useToast } from '../../composables/useToast'
import { budgetUsage, sumByType } from '../../shared/finance'

const { t } = useI18n()
const toast = useToast()
const { budgets, setBudget, setCategoryBudget, removeCategoryBudget, copyBudget } = useBudget()
const { transactions } = useTransactions()
const { expenseCategories } = useCategories()
const { formatCurrency, getMonthName } = useFormat()

// ── Month ────────────────────────────────────────────────────────────────────
const todayStr = toLocalDateString(new Date())
const currentKey = todayStr.slice(0, 7)
const month = ref(currentKey)
const shift = (key, n) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const label = (key) => {
  const [y, m] = key.split('-').map(Number)
  return `${getMonthName(m - 1)} ${y}`
}
const isCurrent = computed(() => month.value === currentKey)

// ── Data for the month ───────────────────────────────────────────────────────
const allCats = computed(() => [...defaultExpenseCategories, ...expenseCategories.value])
const catInfo = (v) => allCats.value.find((c) => c.value === v) ?? { value: v, icon: 'tag', label: v }

const monthTx = computed(() => transactions.value.filter((x) => (x.date || '').startsWith(month.value)))
const entry = computed(() => budgets.value[month.value] ?? null)
const usage = computed(() => budgetUsage(budgets.value, month.value, monthTx.value))
const total = computed(() => (usage.value?.total && usage.value.total.limit > 0 ? usage.value.total : null))
const spentAll = computed(() => sumByType(monthTx.value, 'expense'))
const catRows = computed(() => (usage.value?.categories ?? [])
  .map((c) => ({ ...c, info: catInfo(c.category) }))
  .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit)))

const hasAnything = computed(() => !!total.value || catRows.value.length > 0)
const prevKey = computed(() => shift(month.value, -1))
const prevHasBudget = computed(() => {
  const p = budgets.value[prevKey.value]
  return !!p && ((p.total ?? 0) > 0 || Object.keys(p.categories ?? {}).length > 0)
})

// Summary numbers
const pctExact = computed(() => (total.value ? (total.value.spent / total.value.limit) * 100 : 0))
const level = computed(() => (pctExact.value >= 100 ? 'over' : pctExact.value >= 80 ? 'warn' : 'ok'))
const daysLeft = computed(() => {
  if (!isCurrent.value) return 0
  const [y, m, d] = todayStr.split('-').map(Number)
  return new Date(y, m, 0).getDate() - d + 1
})
const perDay = computed(() => (total.value && daysLeft.value && total.value.remaining > 0 ? total.value.remaining / daysLeft.value : null))

// ── Sheet ────────────────────────────────────────────────────────────────────
// mode: 'total' | 'add' | 'edit'
const sheet = ref({ show: false, mode: 'total', category: null })
const saving = ref(false)
const availableCats = computed(() => allCats.value
  .filter((c) => !(c.value in (entry.value?.categories ?? {})))
  .map((c) => ({ value: c.value, label: c.label, icon: c.icon })))

const sheetProps = computed(() => {
  const s = sheet.value
  if (s.mode === 'total') {
    return {
      title: t('budget_page.sheet_total', { month: label(month.value) }),
      hint: t('budget_page.sheet_total_hint'),
      fixed: null, options: [], amount: total.value?.limit ?? null, canDelete: !!total.value,
    }
  }
  if (s.mode === 'edit') {
    const info = catInfo(s.category)
    return {
      title: t('budget_page.sheet_category_edit'),
      hint: '', fixed: { label: info.label, icon: info.icon }, options: [],
      amount: entry.value?.categories?.[s.category] ?? null, canDelete: true,
    }
  }
  return { title: t('budget_page.sheet_category_add'), hint: t('budget_page.sheet_category_hint'), fixed: null, options: availableCats.value, amount: null, canDelete: false }
})

const open = (mode, category = null) => { sheet.value = { show: true, mode, category } }
const close = () => { sheet.value = { ...sheet.value, show: false } }

async function run(fn, okMsg) {
  saving.value = true
  try {
    await fn()
    toast.success(okMsg)
    close()
  } catch (e) {
    console.error('[budget] save failed:', e)
    toast.error(t('toast_save_error'))
  } finally {
    saving.value = false
  }
}

function onSave({ scope, amount }) {
  const s = sheet.value
  if (s.mode === 'total') return run(() => setBudget(month.value, amount), t('budget_page.saved'))
  const cat = s.mode === 'edit' ? s.category : scope
  return run(() => setCategoryBudget(month.value, cat, amount), t('budget_page.saved'))
}
function onDelete() {
  const s = sheet.value
  if (s.mode === 'total') return run(() => setBudget(month.value, 0), t('budget_page.removed'))
  return run(() => removeCategoryBudget(month.value, s.category), t('budget_page.removed'))
}
const copying = ref(false)
async function copyPrev() {
  copying.value = true
  try {
    await copyBudget(prevKey.value, month.value)
    toast.success(t('budget_page.copied'))
  } catch {
    toast.error(t('toast_save_error'))
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Month switcher -->
    <nav class="flex items-center justify-between rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1" :aria-label="t('select_month')">
      <button type="button" class="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="t('previous')" @click="month = shift(month, -1)">
        <AppIcon :icon="ChevronLeft" size="nav" />
      </button>
      <div class="text-center">
        <p class="text-base font-semibold text-gray-900 dark:text-white">{{ label(month) }}</p>
        <button v-if="!isCurrent" type="button" class="text-xs font-semibold text-primary-600 dark:text-primary-400" @click="month = currentKey">{{ t('budget_page.back_to_this_month') }}</button>
        <p v-else class="text-xs text-gray-400">{{ t('budget_page.this_month') }}</p>
      </div>
      <button type="button" class="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="t('next')" @click="month = shift(month, 1)">
        <AppIcon :icon="ChevronRight" size="nav" />
      </button>
    </nav>

    <!-- Summary -->
    <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5">
      <template v-if="total">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ total.remaining >= 0 ? t('budget_page.left_to_spend') : t('budget_page.over_budget') }}
            </p>
            <p class="tabular mt-1 text-3xl font-bold tracking-tight truncate" :class="total.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">
              {{ formatCurrency(Math.abs(total.remaining)) }}
            </p>
          </div>
          <button type="button" class="pressable shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700" @click="open('total')">
            <AppIcon :icon="Pencil" size="xs" />{{ t('budget_page.edit') }}
          </button>
        </div>

        <div class="mt-4 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" :aria-valuenow="Math.round(Math.min(pctExact, 100))" aria-valuemin="0" aria-valuemax="100" :aria-label="t('monthly_total')">
          <div class="h-full rounded-full transition-[width] duration-500 ease-out" :class="{ ok: 'bg-primary-500', warn: 'bg-amber-400', over: 'bg-red-500' }[level]" :style="{ width: Math.min(pctExact, 100) + '%' }" />
        </div>
        <div class="mt-2 flex items-center justify-between gap-2 text-xs">
          <span class="tabular text-gray-500 dark:text-gray-400">{{ t('budget_page.spent_of', { spent: formatCurrency(total.spent), limit: formatCurrency(total.limit) }) }}</span>
          <span class="tabular font-semibold text-gray-700 dark:text-gray-200">{{ Math.round(pctExact) }}%</span>
        </div>

        <p
          class="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
          :class="{
            ok: 'bg-primary-50 text-primary-800 dark:bg-primary-900/25 dark:text-primary-200',
            warn: 'bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-200',
            over: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-200',
          }[level]"
        >
          <AppIcon :icon="{ ok: CircleCheck, warn: TriangleAlert, over: CircleAlert }[level]" size="action" class="shrink-0 mt-px" />
          <span>
            <template v-if="level === 'over'">{{ t('budget_page.tip_over') }}</template>
            <template v-else-if="perDay !== null">{{ t('budget_page.tip_per_day', { amount: formatCurrency(perDay), days: daysLeft }) }}</template>
            <template v-else-if="level === 'warn'">{{ t('budget_page.status_warn') }}</template>
            <template v-else>{{ t('budget_page.tip_ok') }}</template>
          </span>
        </p>
      </template>

      <!-- No total yet -->
      <div v-else class="text-center py-2">
        <span class="mx-auto w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center">
          <AppIcon :icon="Wallet" size="card" />
        </span>
        <p class="mt-3 text-base font-semibold text-gray-900 dark:text-white">{{ t('budget_page.no_total_title', { month: label(month) }) }}</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ spentAll > 0 ? t('budget_page.no_total_spent', { amount: formatCurrency(spentAll) }) : t('budget_page.no_total_desc') }}
        </p>
        <div class="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <BaseButton @click="open('total')"><AppIcon :icon="Plus" size="action" />{{ t('budget_page.set_total') }}</BaseButton>
          <BaseButton v-if="!hasAnything && prevHasBudget" variant="secondary" :loading="copying" @click="copyPrev">
            <AppIcon :icon="Copy" size="action" />{{ t('budget_page.copy_from', { month: label(prevKey) }) }}
          </BaseButton>
        </div>
      </div>
    </section>

    <!-- Category budgets -->
    <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
      <header class="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('budget_page.categories') }}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('budget_page.categories_desc') }}</p>
        </div>
        <button
          v-if="availableCats.length"
          type="button"
          class="pressable shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
          @click="open('add')"
        >
          <AppIcon :icon="Plus" size="xs" />{{ t('add') }}
        </button>
      </header>

      <div v-if="catRows.length" class="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
        <BudgetRow
          v-for="r in catRows"
          :key="r.category"
          :label="r.info.label"
          :icon="r.info.icon"
          :spent="r.spent"
          :limit="r.limit"
          @edit="open('edit', r.category)"
        />
      </div>
      <button
        v-else
        type="button"
        class="w-[calc(100%-2rem)] mx-4 mb-4 py-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        @click="open('add')"
      >
        <span class="inline-flex items-center gap-1.5 font-semibold"><AppIcon :icon="Plus" size="action" />{{ t('budget_page.add_first_category') }}</span>
        <span class="block mt-0.5 text-xs font-normal">{{ t('budget_page.add_first_category_eg') }}</span>
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
