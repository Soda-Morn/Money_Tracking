<script setup>
defineProps({
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

const close = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

        <!-- Modal Content: bottom sheet on mobile, centered card on desktop -->
        <div class="relative bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 w-full sm:max-w-md max-h-[92vh] overflow-y-auto border border-gray-100/50 dark:border-gray-800/50">
          <!-- Drag handle (mobile visual cue) -->
          <div class="sm:hidden flex justify-center pt-3 pb-1">
            <div class="w-9 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <h3 class="text-base font-bold text-gray-900 dark:text-white tracking-tight">{{ title }}</h3>
            <button
              class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              @click="close"
            >
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 modal-body-safe">
            <slot></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
}

/* Mobile: slide up from bottom */
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: translateY(100%);
}

/* Desktop: scale from center */
@media (min-width: 640px) {
  .modal-enter-active .relative,
  .modal-leave-active .relative {
    transition: transform 0.22s cubic-bezier(0.34, 1.1, 0.64, 1);
  }
  .modal-enter-from .relative,
  .modal-leave-to .relative {
    transform: scale(0.94) translateY(6px);
  }
}

/* Safe area padding for iPhone home indicator */
.modal-body-safe {
  padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
}
</style>
