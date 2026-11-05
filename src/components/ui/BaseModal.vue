<script setup>
import { watch, onBeforeUnmount, useId } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'

const { t } = useI18n()

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])
const titleId = useId()

const close = () => {
  emit('close')
}

const onKey = (e) => { if (e.key === 'Escape') close() }

// Lock background scroll while open (otherwise the page scrolls behind the
// sheet on phones) and listen for Escape.
let openCount = 0
const lock = (on) => {
  if (on) {
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    openCount = 1
  } else if (openCount) {
    document.removeEventListener('keydown', onKey)
    document.documentElement.style.overflow = ''
    openCount = 0
  }
}
watch(() => props.show, lock, { immediate: true })
onBeforeUnmount(() => lock(false))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <!-- Backdrop -->
        <div class="modal-backdrop absolute inset-0 bg-black/50 sm:bg-black/45 sm:backdrop-blur-sm" @click="close"></div>

        <!-- Panel: bottom sheet on mobile, centred card on desktop -->
        <div
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          class="modal-panel relative bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain border border-gray-100/50 dark:border-gray-800/50"
        >
          <!-- Sticky header keeps the close button reachable in long forms -->
          <div class="sticky top-0 z-10 bg-white dark:bg-gray-900">
            <div class="sm:hidden flex justify-center pt-2.5 pb-0.5">
              <div class="w-9 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
            </div>
            <div class="flex items-center justify-between pl-5 pr-2 py-1.5 sm:py-2.5 border-b border-gray-100 dark:border-gray-800">
              <h3 :id="titleId" class="text-base font-bold text-gray-900 dark:text-white tracking-tight truncate">{{ title }}</h3>
              <button
                type="button"
                class="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                :aria-label="t('close')"
                @click="close"
              >
                <AppIcon :icon="X" size="button" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-5" :class="{ 'modal-body-safe': !$slots.footer }">
            <slot></slot>
          </div>

          <!-- Optional footer action bar -->
          <div v-if="$slots.footer" class="sticky bottom-0 bg-white dark:bg-gray-900 px-5 py-4 border-t border-gray-100 dark:border-gray-800 modal-body-safe">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.28s var(--ease-out);
}

/* Mobile: slide up from the bottom */
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(100%);
}

/* Desktop: gentle scale from centre */
@media (min-width: 640px) {
  .modal-enter-active .modal-panel,
  .modal-leave-active .modal-panel {
    transition: transform 0.22s var(--ease-out);
  }
  .modal-enter-from .modal-panel,
  .modal-leave-to .modal-panel {
    transform: scale(0.96) translateY(6px);
  }
}

/* Safe area padding for the iPhone home indicator */
.modal-body-safe {
  padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
}
</style>
