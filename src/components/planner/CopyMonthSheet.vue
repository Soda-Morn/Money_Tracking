<script setup>
/** Review previous-month plans and copy the chosen ones into this month (re-dated, pending, no payments). */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import BaseButton from '../ui/BaseButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'
import { shiftDateToMonth } from '../../shared/planner'

const props = defineProps({
  sourcePlans: { type: Array, required: true }, // one-off, non-cancelled plans of the previous month
  targetMonth: { type: String, required: true },
  alreadyCopied: { type: Set, required: true }, // source ids already copied into the target month
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['copy', 'cancel'])
const { t, locale } = useI18n()
const { formatCurrency } = useFormat()

const selected = ref(new Set(props.sourcePlans.filter((p) => !props.alreadyCopied.has(p.id)).map((p) => p.id)))
const toggle = (id) => {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}
const chosen = computed(() => props.sourcePlans.filter((p) => selected.value.has(p.id)))
const total = computed(() => chosen.value.reduce((s, p) => s + Number(p.amount), 0))
const fmt = (d) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(locale.value || 'en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('planner.copy_explainer') }}</p>
    <ul class="space-y-2 max-h-[50dvh] overflow-y-auto -mx-1 px-1">
      <li v-for="p in sourcePlans" :key="p.id">
        <button
          type="button"
          role="checkbox"
          :aria-checked="selected.has(p.id)"
          :disabled="alreadyCopied.has(p.id)"
          :class="[
            'w-full min-h-14 flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50',
            selected.has(p.id) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700',
          ]"
          @click="toggle(p.id)"
        >
          <span :class="['w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', selected.has(p.id) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-600']">
            <AppIcon v-if="selected.has(p.id)" :icon="Check" size="xs" :stroke-width="3" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">{{ p.name }}</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ alreadyCopied.has(p.id) ? t('planner.already_copied') : t('planner.new_due', { date: fmt(shiftDateToMonth(p.dueDate, targetMonth)) }) }}
            </span>
          </span>
          <span class="tabular text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{{ formatCurrency(p.amount) }}</span>
        </button>
      </li>
    </ul>
    <div class="flex flex-col-reverse sm:flex-row gap-2.5">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">{{ t('cancel') }}</BaseButton>
      <BaseButton type="button" size="lg" full-width :loading="saving" :disabled="!chosen.length" @click="emit('copy', chosen)">
        {{ t('planner.copy_n', { count: chosen.length, amount: formatCurrency(total) }) }}
      </BaseButton>
    </div>
  </div>
</template>
