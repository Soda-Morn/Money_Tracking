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
        <div class="absolute inset-0 bg-black/50" @click="close"></div>

        <!-- Modal Content: bottom sheet on mobile, centered card on desktop -->
        <div class="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
          <!-- Drag handle (mobile visual cue) -->
          <div class="sm:hidden flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
            <button
              class="p-2 text-gray-400 hover:text-gray-600 active:text-gray-600 rounded-lg transition-colors"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 modal-body-safe">
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
  transition: transform 0.25s ease;
}

/* Mobile: slide up from bottom */
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: translateY(100%);
}

/* Desktop: scale from center */
@media (min-width: 640px) {
  .modal-enter-from .relative,
  .modal-leave-to .relative {
    transform: scale(0.95);
  }
}

/* Safe area padding for iPhone home indicator */
.modal-body-safe {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}
</style>
