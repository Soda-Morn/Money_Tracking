<script setup>
import { ref, computed, watch } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useCategories } from '../../composables/useCategories'
import { useI18n } from 'vue-i18n'
import { TrendingDown, TrendingUp, Plus } from 'lucide-vue-next'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import AmountInput from '../ui/AmountInput.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import AppIcon from '../ui/AppIcon.vue'

const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({})
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  // Parent sets this while the save request is in flight
  saving: {
    type: Boolean,
    default: false
  },
  // Hide the expense/income toggle when the parent already shows one
  hideTypeToggle: {
    type: Boolean,
    default: false
  }
})

const { getCurrentDate } = useFormat()
const { expenseCategories, incomeCategories, getCategoryInfo } = useCategories()

const form = ref({
  type: props.initialData.type || 'expense',
  amount: props.initialData.amount != null && props.initialData.amount !== '' ? String(props.initialData.amount) : '',
  category: props.initialData.category || '',
  description: props.initialData.description || '',
  date: props.initialData.date || getCurrentDate()
})

// Parent may switch type (quick-add sheet tabs) after mount
watch(() => props.initialData.type, (type) => { if (type) form.value.type = type })

const typeOptions = computed(() => [
  { value: 'expense', label: t('expense'), icon: TrendingDown, activeClass: 'text-red-500 dark:text-red-400' },
  { value: 'income', label: t('income'), icon: TrendingUp, activeClass: 'text-emerald-600 dark:text-emerald-400' },
])

const categoryOptions = computed(() => {
  const list = form.value.type === 'expense' ? expenseCategories.value : incomeCategories.value
  // When editing an older record whose category isn't in the list (e.g. a
  // built-in default), keep it visible so it can stay selected.
  const current = form.value.category
  if (current && !list.some(c => c.value === current)) {
    return [{ value: current, ...getCategoryInfo(current, form.value.type) }, ...list]
  }
  return list
})

// Switching expense ↔ income invalidates a category from the other list
watch(() => form.value.type, () => {
  if (!categoryOptions.value.some(c => c.value === form.value.category)) form.value.category = ''
})

// Validation messages appear only after the first save attempt
const attempted = ref(false)
const amountError = computed(() => attempted.value && !(Number(form.value.amount) > 0) ? t('error_amount_required') : '')
const categoryError = computed(() => attempted.value && !form.value.category ? t('error_category_required') : '')

const isValid = computed(() => {
  return Number(form.value.amount) > 0 && form.value.category && form.value.date
})

const handleSubmit = () => {
  attempted.value = true
  if (!isValid.value) return
  emit('submit', { ...form.value, amount: Number(form.value.amount) })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
    <!-- Type -->
    <SegmentedControl
      v-if="!hideTypeToggle"
      v-model="form.type"
      :options="typeOptions"
      :label="t('transaction')"
    />

    <!-- Amount (hero field) -->
    <AmountInput
      v-model="form.amount"
      :label="t('amount')"
      :tone="form.type === 'income' ? 'income' : 'expense'"
      :error="amountError"
      :autofocus="!isEditing"
    />

    <!-- Category chips -->
    <fieldset>
      <legend class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {{ t('category') }} <span class="text-red-500">*</span>
      </legend>

      <div v-if="categoryOptions.length" role="radiogroup" class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-0.5 -m-0.5">
        <button
          v-for="cat in categoryOptions"
          :key="cat.value"
          type="button"
          role="radio"
          :aria-checked="form.category === cat.value"
          :class="[
            'pressable min-h-[4.25rem] flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center',
            form.category === cat.value
              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:border-primary-500 dark:text-primary-200 ring-1 ring-primary-500'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
          ]"
          @click="form.category = cat.value"
        >
          <AppIcon :name="cat.icon" fallback="tag" size="button" />
          <span class="text-xs font-medium leading-tight line-clamp-2 break-words w-full">{{ cat.label }}</span>
        </button>
      </div>

      <!-- No custom categories yet: guide the user instead of a dead end -->
      <div v-else class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ t('no_categories_hint') }}</p>
        <router-link
          to="/settings/categories"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          @click="emit('cancel')"
        >
          <AppIcon :icon="Plus" size="action" />{{ t('create_category') }}
        </router-link>
      </div>

      <p v-if="categoryError" class="mt-1.5 text-xs text-red-500" role="alert">{{ categoryError }}</p>
    </fieldset>

    <!-- Date + note -->
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        v-model="form.date"
        type="date"
        :label="t('date')"
        :required="true"
      />
      <BaseInput
        v-model="form.description"
        :label="t('note_optional')"
        :placeholder="t('description_placeholder')"
        maxlength="120"
        enterkeyhint="done"
      />
    </div>

    <!-- Actions: primary action first on mobile (closest to the thumb) -->
    <div class="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
      <BaseButton type="button" variant="ghost" size="lg" full-width :disabled="saving" @click="emit('cancel')">
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" size="lg" full-width :loading="saving">
        {{ isEditing ? t('save_changes') : t('save_transaction') }}
      </BaseButton>
    </div>
  </form>
</template>
