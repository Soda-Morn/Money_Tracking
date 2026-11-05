<script setup>
/**
 * Pill-style toggle (e.g. Expense | Income). Each option:
 *   { value, label, icon?, activeClass? }  — activeClass tints the selected label.
 * Keyboard: it's a radiogroup; arrow keys move between options.
 */
import AppIcon from './AppIcon.vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const move = (event, index) => {
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!delta) return
  event.preventDefault()
  const next = props.options[(index + delta + props.options.length) % props.options.length]
  emit('update:modelValue', next.value)
  event.currentTarget.parentElement?.children[props.options.indexOf(next)]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label || undefined"
    class="grid gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
  >
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      :tabindex="modelValue === opt.value ? 0 : -1"
      :class="[
        'pressable h-11 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold',
        modelValue === opt.value
          ? ['bg-white dark:bg-gray-700 shadow-sm', opt.activeClass || 'text-gray-900 dark:text-white']
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
      ]"
      @click="emit('update:modelValue', opt.value)"
      @keydown="move($event, i)"
    >
      <AppIcon v-if="opt.icon" :icon="opt.icon" size="action" />
      <span class="truncate">{{ opt.label }}</span>
    </button>
  </div>
</template>
