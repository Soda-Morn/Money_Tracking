<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useCategories } from '../../composables/useCategories'

const props = defineProps({
  transaction: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['view', 'edit', 'delete'])

const { t } = useI18n()
const { formatCurrency } = useFormat()
const { getCategoryInfo } = useCategories()

const categoryInfo = computed(() =>
  getCategoryInfo(props.transaction.category, props.transaction.type)
)

const menuOpen = ref(false)
const menuRef = ref(null)

const toggleMenu = () => { menuOpen.value = !menuOpen.value }
const closeMenu = () => { menuOpen.value = false }

const onDocClick = (event) => {
  if (!menuRef.value) return
  if (!menuRef.value.contains(event.target)) closeMenu()
}

const onDocKeydown = (event) => {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700 transition-colors">
    <!-- Category Icon -->
    <div :class="[
      'w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg',
      transaction.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
    ]">
      {{ categoryInfo.icon }}
    </div>

    <!-- Details -->
    <div class="flex-1 min-w-0">
      <p class="font-medium text-gray-900 dark:text-white truncate">
        {{ categoryInfo.label }}
      </p>
      <p v-if="transaction.description" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        {{ transaction.description }}
      </p>
    </div>

    <!-- Amount & Menu -->
    <div class="shrink-0 flex items-center gap-1">
      <span :class="[
        'font-semibold text-sm',
        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
      ]">
        {{ transaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
      </span>

      <div ref="menuRef" class="relative">
        <button
          class="p-2 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 active:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          @click.stop="toggleMenu"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </button>

        <Transition
          enter-active-class="transition ease-out duration-120"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="menuOpen"
            class="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-10"
            role="menu"
          >
            <button
              class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('view', transaction)"
            >
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {{ t('view') }}
            </button>
            <button
              class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('edit', transaction)"
            >
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {{ t('edit_transaction') }}
            </button>
            <button
              class="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('delete', transaction.id)"
            >
              <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {{ t('delete') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
