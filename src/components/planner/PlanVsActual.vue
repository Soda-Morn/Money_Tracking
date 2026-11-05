<script setup>
/**
 * Planned vs actual for one month (rules in src/shared/planner.js#planVsActual):
 * paid plans use the REAL transaction amount; pending plans are listed as
 * "still to pay"; cancelled plans are excluded (never shown as "saved").
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert, Scale } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'
import { planVsActual } from '../../shared/planner'

const props = defineProps({
  plans: { type: Array, required: true },
  transactionsById: { type: Map, required: true },
})
const { t } = useI18n()
const { formatCurrency } = useFormat()

const r = computed(() => planVsActual(props.plans, props.transactionsById))
const max = computed(() => Math.max(1, ...r.value.rows.flatMap((x) => [x.planned, x.actual])))
const diffText = (d) => (d > 0 ? t('planner.under_by', { amount: formatCurrency(d) }) : d < 0 ? t('planner.over_by', { amount: formatCurrency(-d) }) : t('planner.on_plan'))
const diffClass = (d) => (d > 0 ? 'text-emerald-600 dark:text-emerald-400' : d < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')
</script>

<template>
  <div>
    <!-- Nothing paid yet: explain instead of showing an empty chart -->
    <div v-if="!r.rows.length" class="flex items-start gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">
      <span class="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-400">
        <AppIcon :icon="Scale" size="button" />
      </span>
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('planner.compare_empty') }}</p>
    </div>

    <template v-else>
      <!-- Totals -->
      <!-- Stack on very narrow phones so amounts are never cut off -->
      <div class="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2 mb-4">
        <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('planner.total_planned') }}</p>
          <p class="tabular text-base sm:text-lg font-bold text-gray-900 dark:text-white break-words">{{ formatCurrency(r.totalPlanned) }}</p>
        </div>
        <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('planner.total_actual') }}</p>
          <p class="tabular text-base sm:text-lg font-bold text-gray-900 dark:text-white break-words">{{ formatCurrency(r.totalActual) }}</p>
        </div>
        <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ r.difference >= 0 ? t('planner.under_budget') : t('planner.over_budget') }}</p>
          <p :class="['tabular text-base sm:text-lg font-bold break-words', diffClass(r.difference)]">{{ formatCurrency(Math.abs(r.difference)) }}</p>
        </div>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">{{ t('planner.compare_explainer', { count: r.rows.length }) }}</p>

      <!-- Legend -->
      <div class="flex items-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-300">
        <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-gray-300 dark:bg-gray-600" aria-hidden="true" />{{ t('planner.planned') }}</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-primary-500" aria-hidden="true" />{{ t('planner.actual') }}</span>
      </div>

      <!-- Rows: name + amounts, then paired bars -->
      <ul class="space-y-4">
        <li v-for="row in r.rows" :key="row.id">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ row.name }}</p>
            <p :class="['tabular text-xs font-semibold whitespace-nowrap', diffClass(row.difference)]">{{ diffText(row.difference) }}</p>
          </div>
          <div class="mt-1.5 space-y-1" role="img" :aria-label="`${row.name}: ${t('planner.planned')} ${formatCurrency(row.planned)}, ${t('planner.actual')} ${formatCurrency(row.actual)}`">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div class="h-full rounded-full bg-gray-300 dark:bg-gray-600" :style="{ width: (row.planned / max) * 100 + '%' }" />
              </div>
              <span class="tabular w-20 text-right text-xs text-gray-500 dark:text-gray-400">{{ formatCurrency(row.planned) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div class="h-full rounded-full bg-primary-500" :style="{ width: (row.actual / max) * 100 + '%' }" />
              </div>
              <span class="tabular w-20 text-right text-xs font-semibold text-gray-900 dark:text-white">{{ formatCurrency(row.actual) }}</span>
            </div>
          </div>
          <p v-if="row.transactionMissing" class="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AppIcon :icon="TriangleAlert" size="xs" />{{ t('planner.transaction_missing') }}
          </p>
        </li>
      </ul>
    </template>

    <p v-if="r.pending.length" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
      {{ t('planner.still_to_pay', { count: r.pending.length, amount: formatCurrency(r.pendingTotal) }) }}
    </p>
  </div>
</template>
