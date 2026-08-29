<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFormat } from '../../composables/useFormat'
import { useSavingsGoals } from '../../composables/useSavingsGoals'
import { useI18n } from 'vue-i18n'
import ProgressBar from '../ui/ProgressBar.vue'

const props = defineProps({
  goal: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'addMoney'])

const { formatCurrency } = useFormat()
const { getProgress } = useSavingsGoals()
const { t } = useI18n()

const progress = computed(() => getProgress(props.goal))
const remaining = computed(() => Math.max(0, props.goal.targetAmount - props.goal.currentAmount))
const isCompleted = computed(() => props.goal.currentAmount >= props.goal.targetAmount)

const progressColor = computed(() => {
  if (isCompleted.value) return 'green'
  if (progress.value >= 75) return 'teal'
  if (progress.value >= 50) return 'yellow'
  return 'teal'
})

// ── Overflow menu (Update / Delete) ───────────────────────────────────────────
const menuOpen = ref(false)
const menuRef = ref(null)
const toggleMenu = () => { menuOpen.value = !menuOpen.value }
const closeMenu = () => { menuOpen.value = false }

const onDocClick = (event) => {
  if (!menuRef.value) return
  if (!menuRef.value.contains(event.target)) closeMenu()
}
const onDocKeydown = (event) => { if (event.key === 'Escape') closeMenu() }

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
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="p-4 border-b border-gray-100 dark:border-gray-700">
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'w-10 h-10 rounded-full flex items-center justify-center text-lg',
            isCompleted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
          ]">
            {{ goal.icon || '🎯' }}
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ goal.name }}</h3>
            <p v-if="goal.deadline" class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('date') }}: {{ goal.deadline }}
            </p>
            <span
              v-if="goal.priority === 'high' && !isCompleted"
              class="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full"
            >
              {{ t('high_priority_badge') }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Completed Badge -->
          <span
            v-if="isCompleted"
            class="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full"
          >
            {{ t('completed') }}
          </span>

          <!-- Overflow menu -->
          <div ref="menuRef" class="relative">
            <button
              class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              :aria-expanded="menuOpen ? 'true' : 'false'"
              aria-haspopup="menu"
              @click.stop="toggleMenu"
            >
              <svg class="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
                class="absolute right-0 mt-1.5 w-36 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden z-10"
                role="menu"
              >
                <button
                  class="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  role="menuitem"
                  @click="closeMenu(); emit('edit', goal)"
                >
                  <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {{ t('update') }}
                </button>
                <div class="h-px bg-gray-100 dark:bg-gray-800 mx-2"></div>
                <button
                  class="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  role="menuitem"
                  @click="closeMenu(); emit('delete', goal.id)"
                >
                  <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {{ t('delete') }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress -->
    <div class="p-4">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-600 dark:text-gray-400">{{ t('overall_progress') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ Math.round(progress) }}%</span>
      </div>
      <ProgressBar :progress="progress" :color="progressColor" height="h-3" />

      <div class="flex justify-between mt-3 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400">{{ t('total_saved') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(goal.currentAmount) }}</p>
        </div>
        <div class="text-right">
          <p class="text-gray-500 dark:text-gray-400">{{ t('total_target') }}</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(goal.targetAmount) }}</p>
        </div>
      </div>

      <p v-if="!isCompleted" class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {{ formatCurrency(remaining) }} {{ t('remaining') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="border-t border-gray-100 dark:border-gray-700">
      <button
        v-if="!isCompleted"
        class="w-full px-4 py-3 text-sm font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        @click="emit('addMoney', goal)"
      >
        {{ t('add_money') }}
      </button>
      <button
        v-else
        disabled
        class="w-full px-4 py-3 text-sm font-semibold text-gray-400 dark:text-gray-600 cursor-not-allowed"
      >
        {{ t('goal_achieved') }}
      </button>
    </div>
  </div>
</template>
