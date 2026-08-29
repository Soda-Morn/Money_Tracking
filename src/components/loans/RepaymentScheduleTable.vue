<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  schedule: { type: Array, default: () => [] } // [{ date, payment, remaining }], next payment first
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormat()

const VISIBLE_COUNT = 4
const expanded = ref(false)

const visibleRows = computed(() => expanded.value ? props.schedule : props.schedule.slice(0, VISIBLE_COUNT))
const hiddenCount = computed(() => Math.max(0, props.schedule.length - VISIBLE_COUNT))
</script>

<template>
  <div v-if="schedule.length > 0" class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
          <th class="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{{ t('date') }}</th>
          <th class="py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-right">{{ t('payment') }}</th>
          <th class="py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-right">{{ t('remaining') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in visibleRows"
          :key="row.date"
          :class="[
            'border-b border-gray-100 dark:border-gray-800',
            i === 0 ? 'bg-primary-50 dark:bg-primary-900/20' : ''
          ]"
        >
          <td class="py-2.5 px-2 text-gray-900 dark:text-white whitespace-nowrap">
            {{ formatDate(row.date) }}
            <span v-if="i === 0" class="ml-1.5 text-[10px] font-semibold uppercase text-primary-600 dark:text-primary-400">{{ t('next') }}</span>
            <span v-else-if="i === visibleRows.length - 1 && !expanded && hiddenCount === 0" class="ml-1.5 text-[10px] font-semibold uppercase text-tertiary-600 dark:text-tertiary-400">{{ t('final') }}</span>
            <span v-else-if="expanded && i === schedule.length - 1" class="ml-1.5 text-[10px] font-semibold uppercase text-tertiary-600 dark:text-tertiary-400">{{ t('final') }}</span>
          </td>
          <td class="py-2.5 px-2 text-right text-gray-900 dark:text-white whitespace-nowrap">{{ formatCurrency(row.payment) }}</td>
          <td class="py-2.5 px-2 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatCurrency(row.remaining) }}</td>
        </tr>
      </tbody>
    </table>

    <button
      v-if="!expanded && hiddenCount > 0"
      class="w-full mt-2 py-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
      @click="expanded = true"
    >
      {{ t('view_all_n_payments', { n: hiddenCount }) }}
    </button>
  </div>
</template>
