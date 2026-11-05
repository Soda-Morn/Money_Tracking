<script setup>
/**
 * Confirmation for destructive actions. Bottom sheet on mobile, centred card
 * on desktop. Escape / backdrop = cancel. Pass `loading` while the action runs.
 */
import { watch, onBeforeUnmount, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  icon: { type: [Object, Function], default: () => Trash2 },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()
const cancelBtn = ref(null)

const onKey = (e) => { if (e.key === 'Escape' && !props.loading) emit('cancel') }

watch(() => props.show, async (open) => {
  if (open) {
    document.addEventListener('keydown', onKey)
    await nextTick()
    // Focus the safe choice first, so Enter never deletes by accident
    cancelBtn.value?.$el?.focus()
  } else {
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
        <div class="sheet-backdrop absolute inset-0 bg-black/45 sm:bg-black/40 sm:backdrop-blur-sm" @click="!loading && emit('cancel')" />
        <div
          role="alertdialog"
          aria-modal="true"
          :aria-label="title"
          class="sheet-panel relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl px-6 pt-5 sm:pt-6 sheet-safe"
        >
          <div class="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
          <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <AppIcon :icon="icon" size="card" class="text-red-500" />
          </div>
          <h3 class="text-lg font-bold text-center text-gray-900 dark:text-white mb-1">{{ title }}</h3>
          <p v-if="message" class="text-sm text-center text-gray-500 dark:text-gray-400 mb-6 break-words">{{ message }}</p>
          <div class="flex flex-col-reverse sm:flex-row gap-2.5">
            <BaseButton ref="cancelBtn" variant="secondary" size="lg" full-width :disabled="loading" @click="emit('cancel')">
              {{ t('cancel') }}
            </BaseButton>
            <BaseButton variant="danger" size="lg" full-width :loading="loading" @click="emit('confirm')">
              {{ confirmLabel || t('delete') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-safe {
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
}
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-active .sheet-panel, .sheet-leave-active .sheet-panel {
  transition: transform 0.26s var(--ease-out);
}
.sheet-enter-from .sheet-panel, .sheet-leave-to .sheet-panel { transform: translateY(100%); }
@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel, .sheet-leave-to .sheet-panel { transform: scale(0.95); }
}
</style>
