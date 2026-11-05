<script setup>
/**
 * One budget / limit as a tappable row:
 *   [icon]  Food                      $3.00 left
 *           $7.00 of $10.00
 *   ▰▰▰▰▰▰▰▱▱▱
 * Status is shown by icon + text, never colour alone.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleAlert, TriangleAlert, ChevronRight, CalendarDays } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: 'wallet' },
  spent: { type: Number, required: true },
  limit: { type: Number, required: true },
  note: { type: String, default: '' },        // e.g. "Nov 5 – Nov 20"
  inactive: { type: String, default: '' },    // e.g. "Starts Nov 20" — limit not counting today
})
defineEmits(['edit'])
const { t } = useI18n()
const { formatCurrency } = useFormat()

const exact = computed(() => (props.limit > 0 ? (props.spent / props.limit) * 100 : 0))
const level = computed(() => (exact.value >= 100 ? 'over' : exact.value >= 80 ? 'warn' : 'ok'))
const remaining = computed(() => props.limit - props.spent)
const bar = computed(() => ({ over: 'bg-red-500', warn: 'bg-amber-400', ok: 'bg-primary-500' })[level.value])
const width = computed(() => `${Math.min(exact.value, 100)}%`)
</script>

<template>
  <button
    type="button"
    class="pressable w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800/60"
    :aria-label="`${label}: ${formatCurrency(spent)} / ${formatCurrency(limit)}. ${t('budget_page.tap_to_edit')}`"
    @click="$emit('edit')"
  >
    <div class="flex items-center gap-3" :class="inactive ? 'opacity-60' : ''">
      <span class="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
        <AppIcon :name="icon" fallback="tag" size="button" />
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between gap-2">
          <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ label }}</p>
          <p v-if="inactive" class="text-xs font-semibold whitespace-nowrap text-gray-500 dark:text-gray-400">{{ inactive }}</p>
          <p
            v-else
            class="tabular text-sm font-semibold whitespace-nowrap"
            :class="level === 'over' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'"
          >
            {{ remaining >= 0 ? t('limits.left', { amount: formatCurrency(remaining) }) : t('limits.over_by', { amount: formatCurrency(-remaining) }) }}
          </p>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5">
          <p class="tabular text-xs text-gray-500 dark:text-gray-400 truncate">
            <template v-if="inactive">{{ formatCurrency(limit) }}</template>
            <template v-else>{{ t('budget_page.spent_of', { spent: formatCurrency(spent), limit: formatCurrency(limit) }) }}</template>
          </p>
          <p
            v-if="level !== 'ok' && !inactive"
            class="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
            :class="level === 'over' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'"
          >
            <AppIcon :icon="level === 'over' ? CircleAlert : TriangleAlert" size="xs" />
            {{ level === 'over' ? t('budget_page.status_over') : t('budget_page.status_warn') }}
          </p>
        </div>
        <p v-if="note" class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300">
          <AppIcon :icon="CalendarDays" size="xs" />{{ note }}
        </p>
      </div>
      <AppIcon :icon="ChevronRight" size="action" class="text-gray-300 dark:text-gray-600 shrink-0" />
    </div>
    <div v-if="!inactive" class="mt-2.5 ml-[3.25rem] mr-7 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" aria-hidden="true">
      <div :class="['h-full rounded-full transition-[width] duration-500 ease-out', bar]" :style="{ width }" />
    </div>
  </button>
</template>
