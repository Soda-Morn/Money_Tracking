<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormat } from '../../composables/useFormat'
import { useCategories } from '../../composables/useCategories'
import { Ellipsis, Eye, Pencil, Trash2 } from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'

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

// Listen for outside clicks / Escape only while THIS menu is open. Previously
// every row kept two document listeners for its whole life, so each click
// anywhere ran one handler per visible row.
const listen = (on) => {
  const fn = on ? 'addEventListener' : 'removeEventListener'
  document[fn]('click', onDocClick)
  document[fn]('keydown', onDocKeydown)
}
watch(menuOpen, (open) => listen(open))
onBeforeUnmount(() => listen(false))
</script>

<template>
  <div class="flex items-center gap-3 py-2 pl-3 pr-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 dark:active:bg-gray-800 transition-colors group">
    <!-- Category Icon -->
    <div :class="[
      'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg shadow-sm',
      transaction.type === 'income'
        ? 'bg-emerald-100 dark:bg-emerald-900/30'
        : transaction.type === 'borrow'
          ? 'bg-primary-100 dark:bg-primary-900/30'
          : transaction.type === 'payback'
            ? 'bg-tertiary-100 dark:bg-tertiary-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
    ]">
      <AppIcon
        :name="categoryInfo.icon"
        fallback="tag"
        size="button"
        :class="transaction.type === 'income'
          ? 'text-emerald-600 dark:text-emerald-400'
          : transaction.type === 'borrow'
            ? 'text-primary-600 dark:text-primary-400'
            : transaction.type === 'payback'
              ? 'text-tertiary-600 dark:text-tertiary-400'
              : 'text-red-500 dark:text-red-400'"
      />
    </div>

    <!-- Details -->
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-sm text-gray-900 dark:text-white truncate leading-tight">
        {{ categoryInfo.label }}
      </p>
      <p v-if="transaction.description" class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
        {{ transaction.description }}
      </p>
    </div>

    <!-- Amount & Menu -->
    <div class="shrink-0 flex items-center gap-0.5">
      <span :class="[
        'font-bold text-sm tabular whitespace-nowrap',
        transaction.type === 'income'  ? 'text-emerald-600 dark:text-emerald-400' :
        transaction.type === 'borrow'  ? 'text-primary-600 dark:text-primary-400' :
        transaction.type === 'payback' ? 'text-tertiary-600 dark:text-tertiary-400' :
                                          'text-red-500 dark:text-red-400'
      ]">
        {{ transaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
      </span>

      <div ref="menuRef" class="relative">
        <button
          class="w-11 h-11 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-[opacity,color,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
          :class="menuOpen ? 'lg:opacity-100 bg-gray-100 dark:bg-gray-700' : ''"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          :aria-label="t('more_actions')"
          @click.stop="toggleMenu"
        >
          <AppIcon :icon="Ellipsis" size="action" />
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
            class="absolute right-0 mt-1 w-48 py-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden z-10"
            role="menu"
          >
            <button
              class="w-full min-h-11 px-3.5 py-2.5 flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('view', transaction)"
            >
              <AppIcon :icon="Eye" size="action" class="text-gray-400" />
              {{ t('view') }}
            </button>
            <button
              class="w-full min-h-11 px-3.5 py-2.5 flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('edit', transaction)"
            >
              <AppIcon :icon="Pencil" size="action" class="text-primary-400" />
              {{ t('edit_transaction') }}
            </button>
            <div class="h-px bg-gray-100 dark:bg-gray-800 mx-2"></div>
            <button
              class="w-full min-h-11 px-3.5 py-2.5 flex items-center gap-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              role="menuitem"
              @click="closeMenu(); emit('delete', transaction.id)"
            >
              <AppIcon :icon="Trash2" size="action" class="text-red-400" />
              {{ t('delete') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
