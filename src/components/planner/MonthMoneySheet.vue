<script setup>
/**
 * Edit a month's expected income lines and planned savings.
 * Expected income never creates real income; planned savings never move money —
 * they can point at an existing Savings Goal so the plan stays connected.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, X, Wallet, PiggyBank } from 'lucide-vue-next'
import BaseButton from '../ui/BaseButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useSavingsGoals } from '../../composables/useSavingsGoals'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  monthDoc: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel'])
const { t } = useI18n()
const { goals } = useSavingsGoals()
const { formatCurrency } = useFormat()

const rid = () => Math.random().toString(36).slice(2, 10)
const incomes = ref((props.monthDoc?.incomes || []).map((i) => ({ ...i, amount: String(i.amount) })))
const savings = ref((props.monthDoc?.savings || []).map((s) => ({ ...s, amount: String(s.amount), goalId: s.goalId || '' })))
if (!incomes.value.length) incomes.value.push({ id: rid(), label: t('planner.default_income_label'), amount: '' })

const addIncome = () => incomes.value.push({ id: rid(), label: '', amount: '' })
const addSaving = () => savings.value.push({ id: rid(), goalId: goals.value[0]?.id || '', label: '', amount: '' })

const sum = (list) => list.reduce((s, x) => s + (Number(x.amount) || 0), 0)
const attempted = ref(false)
const valid = (x, needsLabel) => Number(x.amount) > 0 && (!needsLabel || String(x.label).trim())
const bad = (x, needsLabel) => attempted.value && !valid(x, needsLabel)

const goalName = (id) => goals.value.find((g) => g.id === id)?.name || ''

// Blank rows are ignored; any partly-filled row must be complete
const isBlankIncome = (i) => i.amount === '' && !String(i.label).trim()
const isBlankSaving = (s) => s.amount === '' && !s.goalId && !String(s.label).trim()
const hasErrors = computed(() => attempted.value && (
  !incomes.value.every((i) => isBlankIncome(i) || valid(i, true))
  || !savings.value.every((s) => isBlankSaving(s) || valid(s, !s.goalId))
))

const save = () => {
  attempted.value = true
  const keepIncome = incomes.value.filter((i) => i.amount !== '' || String(i.label).trim())
  const keepSaving = savings.value.filter((s) => s.amount !== '' || s.goalId || String(s.label).trim())
  if (!keepIncome.every((i) => valid(i, true)) || !keepSaving.every((s) => valid(s, !s.goalId))) return
  emit('save', {
    incomes: keepIncome.map((i) => ({ id: i.id, label: i.label, amount: Number(i.amount) })),
    savings: keepSaving.map((s) => ({ id: s.id, goalId: s.goalId || '', label: s.goalId ? goalName(s.goalId) : s.label, amount: Number(s.amount) })),
  })
}

const inputCls = 'h-12 px-3.5 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500'
const borderCls = (isBad) => (isBad ? 'border-red-400' : 'border-gray-200 dark:border-gray-700')
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="save">
    <!-- Expected income -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h4 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <AppIcon :icon="Wallet" size="action" class="text-emerald-600" />{{ t('planner.expected_income') }}
        </h4>
        <span class="tabular text-sm font-semibold text-gray-700 dark:text-gray-200">{{ formatCurrency(sum(incomes)) }}</span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ t('planner.income_explainer') }}</p>
      <div class="space-y-2">
        <div v-for="(i, idx) in incomes" :key="i.id" class="flex gap-2">
          <input v-model="i.label" :aria-label="t('planner.income_label')" :placeholder="t('planner.income_label_placeholder')" maxlength="40" :class="[inputCls, borderCls(bad(i, true) && !String(i.label).trim()), 'flex-1 min-w-0']" />
          <input v-model="i.amount" inputmode="decimal" :aria-label="t('amount')" placeholder="0.00" :class="[inputCls, borderCls(bad(i, true) && !(Number(i.amount) > 0)), 'w-28 tabular text-right']" />
          <button type="button" class="w-11 h-12 shrink-0 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" :aria-label="t('delete')" @click="incomes.splice(idx, 1)">
            <AppIcon :icon="X" size="action" />
          </button>
        </div>
      </div>
      <button type="button" class="mt-2 h-11 inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-primary-600 dark:text-primary-400" @click="addIncome">
        <AppIcon :icon="Plus" size="action" />{{ t('planner.add_income_line') }}
      </button>
    </section>

    <!-- Planned savings -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h4 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <AppIcon :icon="PiggyBank" size="action" class="text-teal-600" />{{ t('planner.planned_savings') }}
        </h4>
        <span class="tabular text-sm font-semibold text-gray-700 dark:text-gray-200">{{ formatCurrency(sum(savings)) }}</span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ t('planner.savings_explainer') }}</p>
      <div class="space-y-2">
        <div v-for="(s, idx) in savings" :key="s.id" class="flex gap-2">
          <select v-model="s.goalId" :aria-label="t('planner.saving_goal')" :class="[inputCls, borderCls(false), 'flex-1 min-w-0 pr-8']">
            <option v-for="g in goals" :key="g.id" :value="g.id">{{ g.name }}</option>
            <option value="">{{ t('planner.saving_other') }}</option>
          </select>
          <input v-if="!s.goalId" v-model="s.label" :aria-label="t('planner.income_label')" :placeholder="t('planner.saving_label_placeholder')" maxlength="40" :class="[inputCls, borderCls(bad(s, true) && !String(s.label).trim()), 'flex-1 min-w-0']" />
          <input v-model="s.amount" inputmode="decimal" :aria-label="t('amount')" placeholder="0.00" :class="[inputCls, borderCls(bad(s, false) && !(Number(s.amount) > 0)), 'w-28 tabular text-right']" />
          <button type="button" class="w-11 h-12 shrink-0 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" :aria-label="t('delete')" @click="savings.splice(idx, 1)">
            <AppIcon :icon="X" size="action" />
          </button>
        </div>
      </div>
      <button type="button" class="mt-2 h-11 inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-primary-600 dark:text-primary-400" @click="addSaving">
        <AppIcon :icon="Plus" size="action" />{{ t('planner.add_saving_line') }}
      </button>
    </section>

    <p v-if="hasErrors" class="text-xs text-red-500" role="alert">{{ t('planner.errors.lines_invalid') }}</p>

    <div class="flex flex-col-reverse sm:flex-row gap-2.5">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">{{ t('cancel') }}</BaseButton>
      <BaseButton type="submit" size="lg" full-width :loading="saving">{{ t('save_changes') }}</BaseButton>
    </div>
  </form>
</template>
