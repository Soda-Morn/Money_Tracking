<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CircleCheck, Clock, CircleAlert, Ban, Repeat, Ellipsis, Pencil, RotateCcw, Trash2, Undo2, CircleStop,
} from 'lucide-vue-next'
import AppIcon from '../ui/AppIcon.vue'
import { useFormat } from '../../composables/useFormat'

const props = defineProps({
  plan: { type: Object, required: true },
  status: { type: String, required: true },        // pending | paid | overdue | cancelled
  categoryInfo: { type: Object, required: true },  // { icon, label }
  actualAmount: { type: Number, default: null },   // from the linked transaction
})
const emit = defineEmits(['pay', 'edit', 'cancel', 'restore', 'delete', 'undo', 'stop'])

const { t, locale } = useI18n()
const { formatCurrency } = useFormat()

const STATUS = {
  pending:   { icon: Clock,        cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  overdue:   { icon: CircleAlert,  cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
  paid:      { icon: CircleCheck,  cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { icon: Ban,          cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}
const badge = computed(() => STATUS[props.status] || STATUS.pending)

const shortDate = (d) => {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(locale.value || 'en-US', { month: 'short', day: 'numeric' })
}

// ── Overflow menu (listens for outside clicks only while open) ──────────────
const menuOpen = ref(false)
const menuRef = ref(null)
const onDoc = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.value?.contains(e.target)) menuOpen.value = false }
const listen = (on) => ['click', 'keydown'].forEach((ev) => document[on ? 'addEventListener' : 'removeEventListener'](ev, onDoc))
watch(menuOpen, listen)
onBeforeUnmount(() => listen(false))
const act = (event) => { menuOpen.value = false; emit(event, props.plan) }

const menuItems = computed(() => {
  const p = props.plan
  if (p.status === 'paid') return [{ event: 'undo', icon: Undo2, label: t('planner.undo_payment'), danger: true }]
  if (p.status === 'cancelled') {
    return [
      { event: 'restore', icon: RotateCcw, label: t('planner.restore') },
      ...(!p.seriesId ? [{ event: 'delete', icon: Trash2, label: t('planner.delete_forever'), danger: true }] : []),
    ]
  }
  return [
    { event: 'edit', icon: Pencil, label: t('planner.edit') },
    { event: 'cancel', icon: Ban, label: t('planner.cancel_plan'), danger: true },
    ...(p.seriesId ? [{ event: 'stop', icon: CircleStop, label: t('planner.stop_repeating') }] : []),
  ]
})
</script>

<template>
  <article
    :class="[
      'group relative rounded-2xl border bg-white dark:bg-gray-900 p-3.5 sm:p-4 transition-colors',
      status === 'overdue' ? 'border-red-200 dark:border-red-900/60' : 'border-gray-100 dark:border-gray-800',
      status === 'cancelled' ? 'opacity-70' : '',
    ]"
  >
    <div class="flex items-start gap-3">
      <span
        :class="[
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
          status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
        ]"
      >
        <AppIcon :name="categoryInfo.icon" fallback="tag" size="button" />
      </span>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <h3 :class="['min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate',status === 'cancelled' ? 'line-through decoration-gray-400' : '']">
            {{ plan.name }}
            <template v-if="plan.seriesId">
              <AppIcon :icon="Repeat" size="xs" class="inline -mt-0.5 ml-1 text-gray-400" />
              <span class="sr-only">({{ t('planner.recurring') }})</span>
            </template>
          </h3>
          <p class="tabular text-[15px] font-bold text-gray-900 dark:text-white whitespace-nowrap">{{ formatCurrency(plan.amount) }}</p>
        </div>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
          {{ categoryInfo.label }} · {{ t('planner.due_on', { date: shortDate(plan.dueDate) }) }}
          <template v-if="plan.description"> · {{ plan.description }}</template>
        </p>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <span :class="['inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg', badge.cls]">
            <AppIcon :icon="badge.icon" size="xs" />{{ t('planner.status.' + status) }}
          </span>
          <span v-if="status === 'paid'" class="tabular text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ t('planner.paid_detail', { amount: formatCurrency(actualAmount ?? plan.actualAmount ?? plan.amount), date: shortDate(plan.paidAt) }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Actions: primary one is big and obvious; the rest live in the menu -->
    <div class="mt-3 flex items-center gap-2">
      <button
        v-if="plan.status === 'pending'"
        type="button"
        class="pressable flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
        @click="emit('pay', plan)"
      >
        <AppIcon :icon="CircleCheck" size="action" />{{ t('planner.mark_paid') }}
      </button>
      <button
        v-else-if="plan.status === 'cancelled'"
        type="button"
        class="pressable flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        @click="emit('restore', plan)"
      >
        <AppIcon :icon="RotateCcw" size="action" />{{ t('planner.restore') }}
      </button>
      <div v-else class="flex-1" />

      <div ref="menuRef" class="relative">
        <button
          type="button"
          class="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :aria-label="t('more_actions')"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-haspopup="menu"
          @click.stop="menuOpen = !menuOpen"
        >
          <AppIcon :icon="Ellipsis" size="action" />
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95"
          leave-active-class="transition duration-100 ease-in" leave-to-class="opacity-0 scale-95"
        >
          <div v-if="menuOpen" role="menu" class="absolute right-0 bottom-full mb-1.5 w-52 origin-bottom-right rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-black/10 overflow-hidden z-20">
            <button
              v-for="item in menuItems"
              :key="item.event"
              type="button"
              role="menuitem"
              :class="['w-full min-h-11 px-3.5 flex items-center gap-2.5 text-sm transition-colors', item.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800']"
              @click="act(item.event)"
            >
              <AppIcon :icon="item.icon" size="action" />{{ item.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </article>
</template>
