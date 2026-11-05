<script setup>
/**
 * Large, centred money field for fast entry on phones.
 * Opens the numeric/decimal keypad; amounts are entered in USD (the storage
 * currency — see useCurrency.js), so the prefix is always "$".
 * v-model is the raw string, exactly like BaseInput, so callers stay unchanged.
 */
import { ref, onMounted, useId } from 'vue'
import { CircleAlert } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }, // 'expense' | 'income' | 'neutral'
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const input = ref(null)
const id = useId()

const toneClass = {
  expense: 'text-red-500 dark:text-red-400',
  income: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-gray-900 dark:text-white',
}

const onInput = (e) => {
  // Accept digits and a single decimal point (comma is normalised for locales that use it)
  let v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
  const firstDot = v.indexOf('.')
  if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  if (v !== e.target.value) e.target.value = v
  emit('update:modelValue', v)
}

// Delay focus until the sheet's slide-in finishes so the keyboard doesn't fight the animation
onMounted(() => { if (props.autofocus) setTimeout(() => input.value?.focus(), 280) })
</script>

<template>
  <div class="text-center">
    <label v-if="label" :for="id" class="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
      {{ label }}
    </label>
    <div class="flex items-baseline justify-center gap-1" :class="toneClass[tone]">
      <span class="text-2xl font-semibold opacity-60">$</span>
      <input
        :id="id"
        ref="input"
        :value="modelValue"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        :aria-invalid="error ? 'true' : undefined"
        class="tabular w-full max-w-[14rem] bg-transparent text-center text-4xl font-bold tracking-tight placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none"
        @input="onInput"
      />
    </div>
    <div class="mx-auto mt-1 h-px max-w-[14rem]" :class="error ? 'bg-red-400' : 'bg-gray-200 dark:bg-gray-700'" />
    <p v-if="error" class="mt-1.5 text-xs text-red-500 inline-flex items-center gap-1" role="alert">
      <AppIcon :icon="CircleAlert" size="xs" />{{ error }}
    </p>
  </div>
</template>
