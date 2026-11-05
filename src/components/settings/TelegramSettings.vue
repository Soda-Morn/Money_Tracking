<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Send, Link2, Unlink, Copy, Check, ExternalLink, CircleCheck, Clock } from 'lucide-vue-next'
import BaseCard from '../ui/BaseCard.vue'
import BaseButton from '../ui/BaseButton.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useTelegramLink, BOT_USERNAME } from '../../composables/useTelegramLink'
import { useToast } from '../../composables/useToast'

const { t, locale } = useI18n()
const toast = useToast()
const { link, loading, pending, secondsLeft, deepLink, createCode, cancelCode, disconnect } = useTelegramLink()

const creating = ref(false)
const copied = ref(false)
const showDisconnect = ref(false)
const disconnecting = ref(false)

const countdown = computed(() => {
  const s = secondsLeft.value
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const startCommand = computed(() => (pending.value ? `/start ${pending.value.code}` : ''))
const linkedName = computed(() =>
  link.value?.username ? `@${link.value.username}` : (link.value?.firstName || t('telegram.linked_account'))
)
const linkedSince = computed(() => {
  const v = link.value?.linkedAt
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return d ? d.toLocaleDateString(locale.value || 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
})

const handleConnect = async () => {
  creating.value = true
  try {
    await createCode()
  } catch (e) {
    console.error('[telegram] create code failed:', e)
    // permission-denied usually means the Firestore rules snippet isn't deployed yet
    toast.error(e?.code === 'permission-denied' ? t('telegram.error_rules') : t('telegram.error_code'))
  } finally {
    creating.value = false
  }
}

const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText(startCommand.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    toast.error(t('telegram.copy_failed'))
  }
}

const confirmDisconnect = async () => {
  disconnecting.value = true
  try {
    await disconnect()
    toast.success(t('telegram.disconnected'))
    showDisconnect.value = false
  } catch (e) {
    console.error('[telegram] disconnect failed:', e)
    toast.error(t('toast_save_error'))
  } finally {
    disconnecting.value = false
  }
}
</script>

<template>
  <BaseCard>
    <div class="flex items-start gap-3">
      <span class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
        <AppIcon :icon="Send" size="button" />
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('telegram.title') }}</h2>
          <span
            v-if="!loading"
            class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
            :class="link ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'"
          >
            <AppIcon v-if="link" :icon="CircleCheck" size="xs" />
            {{ link ? t('telegram.status_connected') : t('telegram.status_not_connected') }}
          </span>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('telegram.description') }}</p>
      </div>
    </div>

    <div v-if="loading" class="skeleton h-11 mt-4" />

    <!-- Connected -->
    <div v-else-if="link" class="mt-4 space-y-3">
      <div class="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm">
        <p class="font-semibold text-gray-900 dark:text-white truncate">{{ linkedName }}</p>
        <p v-if="linkedSince" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('telegram.linked_since', { date: linkedSince }) }}</p>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('telegram.try_commands') }}</p>
      <BaseButton variant="secondary" full-width @click="showDisconnect = true">
        <AppIcon :icon="Unlink" size="action" />{{ t('telegram.disconnect') }}
      </BaseButton>
    </div>

    <!-- Code generated: waiting for Telegram -->
    <div v-else-if="pending" class="mt-4 space-y-3">
      <ol class="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-decimal pl-5">
        <li>{{ t('telegram.step_open') }}</li>
        <li>{{ t('telegram.step_start') }}</li>
      </ol>
      <a
        v-if="deepLink"
        :href="deepLink"
        target="_blank"
        rel="noopener noreferrer"
        class="pressable w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold"
      >
        <AppIcon :icon="ExternalLink" size="button" />{{ t('telegram.open_telegram') }}
      </a>
      <div class="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-2 pl-3">
        <code class="flex-1 min-w-0 truncate text-xs text-gray-700 dark:text-gray-200">{{ startCommand }}</code>
        <button
          type="button"
          class="w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          :aria-label="t('telegram.copy')"
          @click="copyCommand"
        >
          <AppIcon :icon="copied ? Check : Copy" size="action" :class="copied ? 'text-emerald-600' : ''" />
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center gap-1.5 tabular" aria-live="polite">
          <AppIcon :icon="Clock" size="xs" />{{ t('telegram.expires_in', { time: countdown }) }}
        </span>
        <button type="button" class="h-11 px-2 font-semibold hover:text-gray-800 dark:hover:text-gray-200" @click="cancelCode">
          {{ t('cancel') }}
        </button>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('telegram.waiting') }}</p>
    </div>

    <!-- Not connected -->
    <div v-else class="mt-4 space-y-3">
      <p v-if="!BOT_USERNAME" class="text-xs text-amber-600 dark:text-amber-400">{{ t('telegram.missing_bot_username') }}</p>
      <BaseButton full-width :loading="creating" @click="handleConnect">
        <AppIcon v-if="!creating" :icon="Link2" size="action" />{{ t('telegram.connect') }}
      </BaseButton>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('telegram.privacy_note') }}</p>
    </div>

    <ConfirmDialog
      :show="showDisconnect"
      :icon="Unlink"
      :title="t('telegram.disconnect_title')"
      :message="t('telegram.disconnect_message')"
      :confirm-label="t('telegram.disconnect')"
      :loading="disconnecting"
      @confirm="confirmDisconnect"
      @cancel="showDisconnect = false"
    />
  </BaseCard>
</template>
