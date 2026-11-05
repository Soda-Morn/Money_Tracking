<script setup>
import { CircleAlert } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'

// Extra attributes (inputmode, autocomplete, min, step, maxlength…) go to the
// <input> itself, not the wrapper — so callers can tune the mobile keyboard.
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const handleInput = (event) => {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" class="block text-sm font-semibold text-gray-700 dark:text-gray-300">
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>
    <!-- 48px tall; 16px text on mobile prevents iOS from zooming into the field -->
    <input
      v-bind="$attrs"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :class="[
        'w-full h-12 px-3.5 border rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base sm:text-sm',
        error
          ? 'border-red-400 dark:border-red-500 focus:ring-red-400/40 focus:border-red-400'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      ]"
      @input="handleInput"
    />
    <p v-if="error" class="text-xs text-red-500 flex items-center gap-1" role="alert">
      <AppIcon :icon="CircleAlert" size="xs" />
      {{ error }}
    </p>
  </div>
</template>
