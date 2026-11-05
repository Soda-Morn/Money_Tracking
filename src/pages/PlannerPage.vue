<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft, ChevronRight, Plus, Wallet, Receipt, PiggyBank, Scale, Search, X, CalendarClock, Copy, Lightbulb, Pencil,
} from 'lucide-vue-next'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import MobileFAB from '../components/ui/MobileFAB.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import PlanCard from '../components/planner/PlanCard.vue'
import PlanForm from '../components/planner/PlanForm.vue'
import PayDialog from '../components/planner/PayDialog.vue'
import MonthMoneySheet from '../components/planner/MonthMoneySheet.vue'
import AllocationBar from '../components/planner/AllocationBar.vue'
import PlanVsActual from '../components/planner/PlanVsActual.vue'
import CopyMonthSheet from '../components/planner/CopyMonthSheet.vue'
import { usePlanner } from '../composables/usePlanner'
import { useTransactions } from '../composables/useTransactions'
import { useCategories } from '../composables/useCategories'
import { useFormat, toLocalDateString } from '../composables/useFormat'
import { useToast } from '../composables/useToast'
import { addMonths, displayStatus, monthSummary, plannerInsights, sortPlans } from '../shared/planner'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const toast = useToast()
const { formatCurrency } = useFormat()
const { getCategoryInfo, expenseCategories } = useCategories()
const { transactions } = useTransactions()
const planner = usePlanner()
const { plans, series, months, loading } = planner

const today = toLocalDateString(new Date())
const thisMonth = today.slice(0, 7)

// ── Selected month (kept in the URL so it survives refresh / deep links) ─────
const month = ref(/^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month || '') ? route.query.month : thisMonth)
watch(month, (m) => router.replace({ query: m === thisMonth ? {} : { month: m } }))
const monthTitle = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale.value || 'en-US', { month: 'long', year: 'numeric' })
})
const prevMonth = () => { month.value = addMonths(month.value, -1) }
const nextMonth = () => { month.value = addMonths(month.value, 1) }

// Recurring expenses: create this month's occurrences when the month is opened
watch([month, () => series.value.length, loading], async ([m, , isLoading]) => {
  if (isLoading) return
  try { await planner.ensureOccurrences(m) } catch (e) { console.error(e) }
}, { immediate: true })

// ── Data for the month ─────────────────────────────────────────────────────────
const monthPlans = computed(() => plans.value.filter((p) => p.month === month.value))
const prevPlans = computed(() => plans.value.filter((p) => p.month === addMonths(month.value, -1)))
const monthDoc = computed(() => months.value[month.value] || null)
const summary = computed(() => monthSummary(monthPlans.value, monthDoc.value, today))
const insights = computed(() => plannerInsights(monthPlans.value, monthDoc.value, prevPlans.value, today))
const transactionsById = computed(() => new Map(transactions.value.map((tx) => [tx.id, tx])))
const catInfo = (value) => getCategoryInfo(value, 'expense')

const insightText = (i) => {
  const p = { ...i.params }
  for (const k of ['planned', 'income', 'amount']) if (p[k] != null) p[k] = formatCurrency(p[k])
  if (p.category) p.category = catInfo(p.category).label
  return t('planner.insight.' + i.key, p)
}

// ── Filters ──────────────────────────────────────────────────────────────────
const statusFilter = ref('all')
const search = ref('')
const categoryFilter = ref('')
const dueFilter = ref('any') // any | week | past
const sortBy = ref('due')

const statusTabs = computed(() => [
  { value: 'all', count: monthPlans.value.length },
  { value: 'pending', count: summary.value.count.pending },
  { value: 'overdue', count: summary.value.count.overdue },
  { value: 'paid', count: summary.value.count.paid },
  { value: 'cancelled', count: summary.value.count.cancelled },
])

const visiblePlans = computed(() => {
  const q = search.value.trim().toLowerCase()
  const weekEnd = toLocalDateString(new Date(Date.now() + 7 * 86400000))
  const list = monthPlans.value.filter((p) => {
    const st = displayStatus(p, today)
    if (statusFilter.value !== 'all' && st !== statusFilter.value) return false
    if (categoryFilter.value && p.category !== categoryFilter.value) return false
    if (dueFilter.value === 'week' && !(p.dueDate >= today && p.dueDate <= weekEnd)) return false
    if (dueFilter.value === 'past' && !(p.dueDate < today)) return false
    if (q && !String(p.name).toLowerCase().includes(q) && !String(p.description || '').toLowerCase().includes(q)) return false
    return true
  })
  return sortPlans(list, today, sortBy.value)
})
const filtersActive = computed(() => statusFilter.value !== 'all' || search.value || categoryFilter.value || dueFilter.value !== 'any')
const clearFilters = () => { statusFilter.value = 'all'; search.value = ''; categoryFilter.value = ''; dueFilter.value = 'any' }
const usedCategories = computed(() => [...new Set(monthPlans.value.map((p) => p.category))].map((v) => ({ value: v, label: catInfo(v).label })))

// ── Dialog state ───────────────────────────────────────────────────────────────
const saving = ref(false)
const formOpen = ref(false)
const editing = ref(null)
const paying = ref(null)
const moneyOpen = ref(false)
const copyOpen = ref(false)
const confirm = ref(null) // { kind, plan }

const errorMessage = (e) => {
  if (e?.code && t('planner.errors.' + e.code) !== 'planner.errors.' + e.code) return t('planner.errors.' + e.code)
  if (e?.code === 'unavailable' || !navigator.onLine) return t('planner.errors.offline')
  return t('toast_save_error')
}
async function run(fn, successKey) {
  if (saving.value) return false
  saving.value = true
  try {
    const result = await fn()
    if (successKey) toast.success(t(successKey, typeof result === 'number' ? { count: result } : {}))
    return true
  } catch (e) {
    console.error('[planner]', e)
    toast.error(errorMessage(e))
    return false
  } finally {
    saving.value = false
  }
}

const defaultDueDate = computed(() => (month.value === thisMonth ? today : `${month.value}-01`))
const openAdd = () => { editing.value = null; formOpen.value = true }
const openEdit = (p) => { editing.value = p; formOpen.value = true }

const submitForm = async (data) => {
  const ok = await run(() => (editing.value
    ? planner.updatePlan(editing.value.id, data)
    : planner.addPlan(data)), editing.value ? 'planner.toast_updated' : 'planner.toast_added')
  if (ok) {
    formOpen.value = false
    if (!editing.value && data.dueDate.slice(0, 7) !== month.value) month.value = data.dueDate.slice(0, 7)
  }
}

const confirmPay = async (payload) => {
  if (await run(() => planner.markPaid(paying.value.id, payload), 'planner.toast_paid')) paying.value = null
}

const saveMoney = async (data) => {
  if (await run(() => planner.saveMonth(month.value, data), 'planner.toast_month_saved')) moneyOpen.value = false
}

const copySources = computed(() => prevPlans.value.filter((p) => p.status !== 'cancelled' && !p.seriesId))
const alreadyCopied = computed(() => new Set(monthPlans.value.filter((p) => p.copiedFrom).map((p) => p.copiedFrom)))
const doCopy = async (chosen) => {
  if (await run(() => planner.copyPlans(chosen, month.value), 'planner.toast_copied')) copyOpen.value = false
}

const CONFIRMS = {
  cancel: { title: 'planner.confirm_cancel_title', message: 'planner.confirm_cancel_msg', action: 'planner.cancel_plan', fn: (p) => planner.cancelPlan(p.id), toast: 'planner.toast_cancelled' },
  delete: { title: 'planner.confirm_delete_title', message: 'planner.confirm_delete_msg', action: 'planner.delete_forever', fn: (p) => planner.deletePlan(p), toast: 'planner.toast_deleted' },
  undo: { title: 'planner.confirm_undo_title', message: 'planner.confirm_undo_msg', action: 'planner.undo_payment', fn: (p) => planner.undoPayment(p.id), toast: 'planner.toast_undone' },
  stop: { title: 'planner.confirm_stop_title', message: 'planner.confirm_stop_msg', action: 'planner.stop_repeating', fn: (p) => planner.stopSeries(p.seriesId, today), toast: 'planner.toast_stopped' },
}
const confirmCfg = computed(() => (confirm.value ? CONFIRMS[confirm.value.kind] : null))
const runConfirm = async () => {
  const { kind, plan } = confirm.value
  if (await run(() => CONFIRMS[kind].fn(plan), CONFIRMS[kind].toast)) confirm.value = null
}
const restore = (p) => run(() => planner.restorePlan(p.id), 'planner.toast_restored')

const cards = computed(() => [
  { key: 'income', label: t('planner.expected_income'), value: summary.value.expectedIncome, icon: Wallet, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { key: 'expenses', label: t('planner.planned_expenses'), value: summary.value.plannedExpenses, icon: Receipt, tint: 'bg-orange-50 text-[#e0553a] dark:bg-orange-900/20 dark:text-orange-300', hint: summary.value.stillToPay ? t('planner.still_to_pay_short', { amount: formatCurrency(summary.value.stillToPay) }) : '' },
  { key: 'savings', label: t('planner.planned_savings'), value: summary.value.plannedSavings, icon: PiggyBank, tint: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300' },
  { key: 'remaining', label: t('planner.estimated_remaining'), value: summary.value.remaining, icon: Scale, tint: summary.value.remaining < 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' : 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300' },
])
</script>

<template>
  <div class="space-y-5 lg:space-y-6 pb-4">
    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <header class="reveal flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div>
        <h1 class="hidden lg:block text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{{ t('planner.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 lg:mt-1">{{ t('planner.subtitle') }}</p>
      </div>
      <!-- Desktop actions (phones use the floating + and the card links instead) -->
      <div class="hidden lg:flex items-center gap-2">
        <BaseButton variant="secondary" @click="moneyOpen = true">
          <AppIcon :icon="Wallet" size="action" />{{ t('planner.income_and_savings') }}
        </BaseButton>
        <BaseButton @click="openAdd">
          <AppIcon :icon="Plus" size="action" />{{ t('planner.add_expense') }}
        </BaseButton>
      </div>
    </header>

    <!-- Month switcher (thumb-friendly, full width on phones) -->
    <nav class="reveal flex items-center justify-between rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1" :style="{ '--i': 1 }" :aria-label="t('planner.month_nav')">
      <button type="button" class="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="t('previous')" @click="prevMonth">
        <AppIcon :icon="ChevronLeft" size="nav" />
      </button>
      <div class="text-center">
        <p class="text-base font-semibold text-gray-900 dark:text-white">{{ monthTitle }}</p>
        <button v-if="month !== thisMonth" type="button" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline" @click="month = thisMonth">{{ t('planner.back_to_this_month') }}</button>
        <p v-else class="text-xs text-gray-400">{{ t('planner.this_month') }}</p>
      </div>
      <button type="button" class="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="t('next')" @click="nextMonth">
        <AppIcon :icon="ChevronRight" size="nav" />
      </button>
    </nav>

    <!-- ── Summary cards ────────────────────────────────────────────────────── -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3" :aria-label="t('planner.overview')">
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="skeleton h-[104px] rounded-2xl" />
      </template>
      <template v-else>
        <div v-for="(c, i) in cards" :key="c.key" class="reveal rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3.5 sm:p-4 min-w-0" :style="{ '--i': i + 2 }">
          <div class="flex items-center gap-2">
            <span :class="['w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.tint]"><AppIcon :icon="c.icon" size="action" /></span>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">{{ c.label }}</p>
          </div>
          <p :class="['tabular mt-2 text-lg sm:text-xl font-bold tracking-tight truncate', c.key === 'remaining' && c.value < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white']">
            {{ c.key === 'remaining' && c.value < 0 ? '−' : '' }}{{ formatCurrency(Math.abs(c.value)) }}
          </p>
          <button v-if="c.key === 'income' && !c.value" type="button" class="mt-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline" @click="moneyOpen = true">{{ t('planner.add_income_cta') }}</button>
          <button v-else-if="c.key === 'savings' && !c.value" type="button" class="mt-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline" @click="moneyOpen = true">{{ t('planner.add_savings_cta') }}</button>
          <p v-else-if="c.hint" class="tabular mt-0.5 text-xs text-gray-400 truncate">{{ c.hint }}</p>
        </div>
      </template>
    </section>

    <!-- grid-cols-1 = minmax(0,1fr): lets long names truncate instead of widening the page -->
    <div class="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-5 lg:items-start">
      <!-- ── Left: allocation + plan list ─────────────────────────────────── -->
      <div class="lg:col-span-3 space-y-5 lg:space-y-6 min-w-0">
        <BaseCard v-if="!loading && (summary.expectedIncome > 0 || monthPlans.length)" class="reveal" :style="{ '--i': 6 }">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('planner.allocation_title') }}</h2>
            <button type="button" class="lg:hidden inline-flex items-center gap-1 h-9 px-2 text-sm font-semibold text-primary-600 dark:text-primary-400" @click="moneyOpen = true">
              <AppIcon :icon="Pencil" size="xs" />{{ t('planner.income_and_savings') }}
            </button>
          </div>
          <AllocationBar v-if="summary.expectedIncome > 0" :summary="summary" />
          <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('planner.allocation_needs_income') }}</p>

          <ul v-if="insights.length" class="mt-4 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4">
            <li v-for="i in insights" :key="i.key" class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <AppIcon :icon="Lightbulb" size="action" class="mt-0.5 text-amber-500" />{{ insightText(i) }}
            </li>
          </ul>
        </BaseCard>

        <!-- List -->
        <section class="reveal" :style="{ '--i': 7 }" :aria-label="t('planner.list_title')">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('planner.list_title') }}</h2>
            <button v-if="copySources.length" type="button" class="inline-flex items-center gap-1.5 h-9 px-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline" @click="copyOpen = true">
              <AppIcon :icon="Copy" size="action" />{{ t('planner.copy_last_month') }}
            </button>
          </div>

          <template v-if="monthPlans.length">
            <!-- Status tabs (scroll sideways only inside this strip) -->
            <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1" role="tablist">
              <button
                v-for="tab in statusTabs"
                :key="tab.value"
                type="button"
                role="tab"
                :aria-selected="statusFilter === tab.value"
                :class="[
                  'shrink-0 h-9 px-3.5 rounded-full text-sm font-semibold transition-colors',
                  statusFilter === tab.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300',
                ]"
                @click="statusFilter = tab.value"
              >
                {{ t('planner.filter.' + tab.value) }} <span class="tabular opacity-60">{{ tab.count }}</span>
              </button>
            </div>

            <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="relative col-span-2">
                <AppIcon :icon="Search" size="action" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input v-model="search" type="search" :placeholder="t('planner.search')" :aria-label="t('planner.search')" class="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <select v-model="categoryFilter" :aria-label="t('category')" class="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base sm:text-sm text-gray-900 dark:text-white min-w-0">
                <option value="">{{ t('planner.all_categories') }}</option>
                <option v-for="c in usedCategories" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
              <select v-model="dueFilter" :aria-label="t('planner.field_due')" class="h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base sm:text-sm text-gray-900 dark:text-white min-w-0">
                <option value="any">{{ t('planner.due_any') }}</option>
                <option value="week">{{ t('planner.due_week') }}</option>
                <option value="past">{{ t('planner.due_past') }}</option>
              </select>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <label class="inline-flex items-center gap-1.5">
                {{ t('planner.sort_by') }}
                <select v-model="sortBy" class="h-9 px-2 rounded-lg bg-transparent font-semibold text-gray-700 dark:text-gray-200">
                  <option value="due">{{ t('planner.sort_due') }}</option>
                  <option value="amount">{{ t('planner.sort_amount') }}</option>
                </select>
              </label>
              <button v-if="filtersActive" type="button" class="inline-flex items-center gap-1 h-9 px-2 font-semibold hover:text-gray-800 dark:hover:text-gray-200" @click="clearFilters">
                <AppIcon :icon="X" size="xs" />{{ t('clear_all') }}
              </button>
            </div>

            <TransitionGroup v-if="visiblePlans.length" tag="div" name="list" class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PlanCard
                v-for="p in visiblePlans"
                :key="p.id"
                :plan="p"
                :status="displayStatus(p, today)"
                :category-info="catInfo(p.category)"
                :actual-amount="p.transactionId && transactionsById.get(p.transactionId) ? Number(transactionsById.get(p.transactionId).amount) : null"
                @pay="paying = $event"
                @edit="openEdit"
                @cancel="confirm = { kind: 'cancel', plan: $event }"
                @restore="restore"
                @delete="confirm = { kind: 'delete', plan: $event }"
                @undo="confirm = { kind: 'undo', plan: $event }"
                @stop="confirm = { kind: 'stop', plan: $event }"
              />
            </TransitionGroup>
            <p v-else class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('planner.no_match') }}</p>
          </template>

          <div v-else-if="loading" class="space-y-3">
            <div v-for="n in 3" :key="n" class="skeleton h-32 rounded-2xl" />
          </div>

          <!-- Empty month -->
          <div v-else class="rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 px-6 py-10 text-center">
            <span class="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center">
              <AppIcon :icon="CalendarClock" size="hero" />
            </span>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('planner.empty_title') }}</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">{{ t('planner.empty_desc', { month: monthTitle }) }}</p>
            <div class="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
              <BaseButton @click="openAdd"><AppIcon :icon="Plus" size="action" />{{ t('planner.empty_cta') }}</BaseButton>
              <BaseButton v-if="copySources.length" variant="secondary" @click="copyOpen = true"><AppIcon :icon="Copy" size="action" />{{ t('planner.copy_last_month') }}</BaseButton>
            </div>
          </div>
        </section>
      </div>

      <!-- ── Right: planned vs actual ────────────────────────────────────────── -->
      <BaseCard v-if="monthPlans.length" class="reveal lg:col-span-2" :style="{ '--i': 8 }">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('planner.compare_title') }}</h2>
        <PlanVsActual :plans="monthPlans" :transactions-by-id="transactionsById" />
      </BaseCard>
    </div>

    <!-- Phones: thumb-reach add button (desktop uses the header button) -->
    <div class="lg:hidden"><MobileFAB @click="openAdd" /></div>

    <!-- ── Sheets & dialogs ─────────────────────────────────────────────────── -->
    <BaseModal :show="formOpen" :title="editing ? t('planner.edit_title') : t('planner.add_title', { month: monthTitle })" @close="!saving && (formOpen = false)">
      <PlanForm
        v-if="formOpen"
        :key="editing?.id || 'new-' + month"
        :month="editing ? editing.month : month"
        :initial="editing"
        :default-date="defaultDueDate"
        :saving="saving"
        @submit="submitForm"
        @cancel="formOpen = false"
      />
    </BaseModal>

    <BaseModal :show="!!paying" :title="t('planner.pay_title')" @close="!saving && (paying = null)">
      <PayDialog v-if="paying" :plan="paying" :category-label="catInfo(paying.category).label" :today="today" :saving="saving" @confirm="confirmPay" @cancel="paying = null" />
    </BaseModal>

    <BaseModal :show="moneyOpen" :title="t('planner.money_title', { month: monthTitle })" @close="!saving && (moneyOpen = false)">
      <MonthMoneySheet v-if="moneyOpen" :key="month" :month-doc="monthDoc" :saving="saving" @save="saveMoney" @cancel="moneyOpen = false" />
    </BaseModal>

    <BaseModal :show="copyOpen" :title="t('planner.copy_title')" @close="!saving && (copyOpen = false)">
      <CopyMonthSheet v-if="copyOpen" :source-plans="copySources" :target-month="month" :already-copied="alreadyCopied" :saving="saving" @copy="doCopy" @cancel="copyOpen = false" />
    </BaseModal>

    <ConfirmDialog
      :show="!!confirm"
      :title="confirmCfg ? t(confirmCfg.title) : ''"
      :message="confirmCfg ? t(confirmCfg.message, { name: confirm.plan.name }) : ''"
      :confirm-label="confirmCfg ? t(confirmCfg.action) : ''"
      :loading="saving"
      @confirm="runConfirm"
      @cancel="confirm = null"
    />
  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: opacity 0.2s ease, transform 0.2s var(--ease-out); }
.list-enter-from { opacity: 0; transform: translateY(-4px); }
.list-leave-to { opacity: 0; }
</style>
