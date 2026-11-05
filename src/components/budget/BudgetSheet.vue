<script setup>
/**
 * One sheet for adding / editing any budget or limit.
 *  - `options`  : categories to choose from (grid of chips). Empty → no picker.
 *  - `fixed`    : the item being edited ({ label, icon }) — shown instead of the picker
 *  - `periods`  : show the Per day | Per week switch (daily/weekly limits)
 * Amounts are typed in USD (the storage currency, like every other form);
 * in KHR display mode the riel equivalent is shown live underneath.
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import BaseModal from '../ui/BaseModal.vue'
import BaseButton from '../ui/BaseButton.vue'
import AmountInput from '../ui/AmountInput.vue'
import AppIcon from '../ui/AppIcon.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import { useCurrency, USD_TO_KHR } from '../../composables/useCurrency'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  hint: { type: String, default: '' },
  options: { type: Array, default: () => [] },   // [{ value, label, icon }]
  fixed: { type: Object, default: null },        // { label, icon } when editing
  amount: { type: Number, default: null },       // current USD amount when editing
  periods: { type: Boolean, default: false },
  period: { type: String, default: 'day' },
  canDelete: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  withDates: { type: Boolean, default: false },  // show "Every day / Only between dates"
  range: { type: Object, default: null },        // current { from, to } when editing
  today: { type: String, default: '' },
})
const emit = defineEmits(['close', 'save', 'delete'])
const { t, locale } = useI18n()
const { currency } = useCurrency()

const scope = ref('')
const value = ref('')
const per = ref('day')
const touched = ref(false)
const when = ref('always')   // 'always' | 'dates'
const from = ref('')
const to = ref('')

// Reset every time the sheet opens
watch(() => props.show, (open) => {
  if (!open) return
  scope.value = props.fixed ? '__fixed' : (props.options.length === 1 ? props.options[0].value : '')
  value.value = props.amount ? String(props.amount) : ''
  per.value = props.period
  when.value = props.range ? 'dates' : 'always'
  from.value = props.range?.from || props.today
  to.value = props.range?.to || ''
  touched.value = false
}, { immediate: true })

const whenOptions = computed(() => [
  { value: 'always', label: per.value === 'week' ? t('budget_page.every_week') : t('budget_page.every_day') },
  { value: 'dates', label: t('budget_page.between_dates') },
])
const datesError = computed(() => {
  if (!props.withDates || when.value !== 'dates' || !touched.value) return ''
  if (!from.value && !to.value) return t('budget_page.dates_required')
  if (from.value && to.value && to.value < from.value) return t('budget_page.dates_order')
  return ''
})
const datesOk = computed(() => !props.withDates || when.value !== 'dates'
  || ((!!from.value || !!to.value) && !(from.value && to.value && to.value < from.value)))
const dateInput = 'w-full min-w-0 h-12 px-3 text-base sm:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40'

const num = computed(() => Number(value.value))
const amountError = computed(() => (touched.value && !(num.value > 0) ? t('error_amount_required') : ''))
const needsScope = computed(() => !props.fixed && props.options.length > 0)
const canSave = computed(() => num.value > 0 && (!needsScope.value || !!scope.value) && datesOk.value)
const rielHint = computed(() => (currency.value === 'KHR' && num.value > 0
  ? `≈ ${new Intl.NumberFormat(locale.value || 'en-US', { maximumFractionDigits: 0 }).format(num.value * USD_TO_KHR)} ៛`
  : ''))

const periodOptions = computed(() => [
  { value: 'day', label: t('limits.per_day') },
  { value: 'week', label: t('limits.per_week') },
])

function submit() {
  touched.value = true
  if (!canSave.value) return
  const range = props.withDates && when.value === 'dates' ? { from: from.value || null, to: to.value || null } : null
  emit('save', { scope: props.fixed ? null : scope.value, amount: Math.round(num.value * 100) / 100, period: per.value, range })
}
</script>

<template>
  <BaseModal :show="show" :title="title" @close="emit('close')">
    <form class="space-y-5" @submit.prevent="submit">
      <p v-if="hint" class="text-sm text-gray-500 dark:text-gray-400 -mt-1">{{ hint }}</p>

      <!-- Editing: what this is -->
      <div v-if="fixed" class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60">
        <span class="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
          <AppIcon :name="fixed.icon || 'wallet'" fallback="tag" size="button" />
        </span>
        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ fixed.label }}</p>
      </div>

      <!-- Per day | Per week -->
      <div v-if="periods && !fixed">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{{ t('budget_page.period') }}</p>
        <SegmentedControl v-model="per" :options="periodOptions" :label="t('budget_page.period')" />
      </div>

      <!-- Category chips -->
      <div v-if="needsScope">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{{ t('budget_page.what_for') }}</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" :aria-label="t('budget_page.what_for')">
          <button
            v-for="o in options"
            :key="o.value"
            type="button"
            role="radio"
            :aria-checked="scope === o.value"
            :class="[
              'pressable h-12 px-3 flex items-center gap-2 rounded-xl border text-sm font-medium text-left min-w-0 transition-colors',
              scope === o.value
                ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200 dark:border-primary-500 ring-1 ring-primary-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            ]"
            @click="scope = o.value"
          >
            <AppIcon :name="o.icon || 'tag'" fallback="tag" size="action" class="shrink-0" />
            <span class="truncate">{{ o.label }}</span>
          </button>
        </div>
        <p v-if="touched && !scope" class="mt-1.5 text-xs text-red-500" role="alert">{{ t('budget_page.pick_one') }}</p>
      </div>

      <!-- Amount -->
      <div class="pt-1">
        <AmountInput v-model="value" :label="t('budget_page.amount_usd')" :error="amountError" :autofocus="!!fixed || !needsScope" />
        <p v-if="rielHint" class="mt-1.5 text-center text-xs text-gray-500 dark:text-gray-400 tabular">{{ rielHint }}</p>
      </div>

      <!-- When does this limit apply? -->
      <div v-if="withDates">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{{ t('budget_page.when') }}</p>
        <SegmentedControl v-model="when" :options="whenOptions" :label="t('budget_page.when')" />
        <div v-if="when === 'dates'" class="mt-3 grid grid-cols-2 gap-2">
          <label class="min-w-0">
            <span class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('budget_page.from') }}</span>
            <input v-model="from" type="date" :class="dateInput" />
          </label>
          <label class="min-w-0">
            <span class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('budget_page.to') }}</span>
            <input v-model="to" type="date" :min="from || undefined" :class="dateInput" />
          </label>
        </div>
        <p v-if="when === 'dates' && !datesError" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('budget_page.dates_hint') }}</p>
        <p v-if="datesError" class="mt-1.5 text-xs text-red-500" role="alert">{{ datesError }}</p>
      </div>
      <button type="submit" class="hidden" aria-hidden="true" tabindex="-1" />
    </form>

    <template #footer>
      <div class="flex gap-2.5">
        <BaseButton v-if="canDelete" variant="secondary" size="lg" class="text-red-600 dark:text-red-400 shrink-0" :disabled="saving" :aria-label="t('budget_page.remove')" @click="emit('delete')">
          <AppIcon :icon="Trash2" size="action" />
          <span class="hidden sm:inline">{{ t('budget_page.remove') }}</span>
        </BaseButton>
        <BaseButton size="lg" full-width :loading="saving" :disabled="!canSave && touched" @click="submit">
          {{ t('save') }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
