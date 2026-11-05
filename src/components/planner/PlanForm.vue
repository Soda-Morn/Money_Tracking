<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseInput from '../ui/BaseInput.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import BaseButton from '../ui/BaseButton.vue'
import AmountInput from '../ui/AmountInput.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useCategories } from '../../composables/useCategories'
import { validatePlan } from '../../shared/planner'
import { daysInMonth } from '../../shared/finance'

const props = defineProps({
  month: { type: String, required: true },          // 'YYYY-MM' being planned
  initial: { type: Object, default: null },         // a plan when editing
  defaultDate: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()
const { expenseCategories, getCategoryInfo } = useCategories()

const isEdit = computed(() => !!props.initial)
const form = ref({
  name: props.initial?.name || '',
  amount: props.initial?.amount != null ? String(props.initial.amount) : '',
  category: props.initial?.category || '',
  dueDate: props.initial?.dueDate || props.defaultDate || `${props.month}-01`,
  description: props.initial?.description || '',
  frequency: 'none',
})

const [y, m] = props.month.split('-').map(Number)
const minDate = `${props.month}-01`
const maxDate = `${props.month}-${String(daysInMonth(y, m - 1)).padStart(2, '0')}`

// Keep an edited plan's category visible even if it's a built-in/legacy one
const categories = computed(() => {
  const list = expenseCategories.value
  const cur = form.value.category
  return cur && !list.some((c) => c.value === cur) ? [{ value: cur, ...getCategoryInfo(cur, 'expense') }, ...list] : list
})

const frequencyOptions = computed(() => [
  { value: 'none', label: t('planner.freq.none') },
  ...['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((f) => ({ value: f, label: t('planner.freq.' + f) })),
])

const attempted = ref(false)
const errors = computed(() => (attempted.value ? validatePlan({ ...form.value, month: props.month }) : {}))
const errorText = (key) => (errors.value[key] ? t('planner.errors.' + errors.value[key]) : '')

const submit = () => {
  attempted.value = true
  if (Object.keys(validatePlan({ ...form.value, month: props.month })).length) return
  emit('submit', { ...form.value, amount: Number(form.value.amount) })
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <BaseInput
      v-model="form.name"
      :label="t('planner.field_name')"
      :placeholder="t('planner.field_name_placeholder')"
      :error="errorText('name')"
      :required="true"
      maxlength="60"
      autocomplete="off"
      enterkeyhint="next"
    />

    <AmountInput v-model="form.amount" :label="t('planner.field_amount')" tone="expense" :error="errorText('amount')" />

    <fieldset>
      <legend class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {{ t('category') }} <span class="text-red-500">*</span>
      </legend>
      <div v-if="categories.length" role="radiogroup" class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-0.5 -m-0.5">
        <button
          v-for="cat in categories"
          :key="cat.value"
          type="button"
          role="radio"
          :aria-checked="form.category === cat.value"
          :class="[
            'pressable min-h-[4.25rem] flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center',
            form.category === cat.value
              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200 ring-1 ring-primary-500'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
          ]"
          @click="form.category = cat.value"
        >
          <AppIcon :name="cat.icon" fallback="tag" size="button" />
          <span class="text-xs font-medium leading-tight line-clamp-2 break-words w-full">{{ cat.label }}</span>
        </button>
      </div>
      <div v-else class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ t('no_categories_hint') }}</p>
        <router-link to="/settings/categories" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline" @click="emit('cancel')">
          <AppIcon :icon="Plus" size="action" />{{ t('create_category') }}
        </router-link>
      </div>
      <p v-if="errorText('category')" class="mt-1.5 text-xs text-red-500" role="alert">{{ errorText('category') }}</p>
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="form.dueDate"
        type="date"
        :label="t('planner.field_due')"
        :min="minDate"
        :max="maxDate"
        :error="errorText('dueDate')"
        :required="true"
      />
      <BaseSelect
        v-if="!isEdit"
        v-model="form.frequency"
        :label="t('planner.field_repeat')"
        :options="frequencyOptions"
      />
    </div>
    <p v-if="!isEdit && form.frequency !== 'none'" class="-mt-2 text-xs text-gray-500 dark:text-gray-400">
      {{ t('planner.repeat_hint') }}
    </p>

    <BaseInput
      v-model="form.description"
      :label="t('note_optional')"
      :placeholder="t('planner.field_note_placeholder')"
      maxlength="120"
      enterkeyhint="done"
    />

    <div class="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" size="lg" full-width :loading="saving">
        {{ isEdit ? t('save_changes') : t('planner.save_plan') }}
      </BaseButton>
    </div>
  </form>
</template>
