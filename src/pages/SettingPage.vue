<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import { useCurrency, USD_TO_KHR } from '../composables/useCurrency'
import { useTransactions } from '../composables/useTransactions'
import { useCategories } from '../composables/useCategories'
import { useAuth } from '../composables/useAuth'
import { useFormat } from '../composables/useFormat'
import { usePdfExport } from '../composables/usePdfExport'
import { useDataManagement } from '../composables/useDataManagement'
import { useToast } from '../composables/useToast'
import { useStorage } from '../composables/useStorage'

import BaseCard from '../components/ui/BaseCard.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const { locale } = useLanguage()
const { currency } = useCurrency()
const toast = useToast()

const menuItems = computed(() => [
  {
    icon: '🏷️',
    label: t('categories'),
    description: t('categories_desc'),
    route: '/settings/categories'
  },
  {
    icon: '💰',
    label: t('monthly_budget'),
    description: t('budget_desc'),
    route: '/settings/budget'
  }
])

// ── Network & Status ───────────────────────────────────────────────────────────
const isOnline = ref(navigator.onLine)
const updateOnlineStatus = () => { isOnline.value = navigator.onLine }
onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

// Cosmetic preference only — the app already works offline via the PWA service
// worker; this does not switch the data layer away from Firestore.
const offlineModePref = useStorage('offlineModePreference', false)

const APP_VERSION = 'v1.0.0'
const checkingUpdate = ref(false)

const checkForUpdates = async () => {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    if (!('serviceWorker' in navigator)) {
      toast.info(t('no_service_worker'))
      return
    }
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      await reg.update()
      toast.success(t('checked_for_updates'))
    } else {
      toast.info(t('no_service_worker'))
    }
  } finally {
    checkingUpdate.value = false
  }
}

// ── Data Management ────────────────────────────────────────────────────────────
const { transactions, totalIncome, totalExpense, totalBalance } = useTransactions()
const { getCategoryInfo } = useCategories()
const { currentUser } = useAuth()
const { formatCurrency } = useFormat()
const { exportToPdf } = usePdfExport()
const { exportCsv, backupJson, restoreJson, resetAllData } = useDataManagement()

const isExportingPdf = ref(false)
const isImporting = ref(false)
const importFileInput = ref(null)

const handleExportPdf = async () => {
  if (isExportingPdf.value) return
  isExportingPdf.value = true
  try {
    await exportToPdf({
      transactions: transactions.value,
      monthLabel: t('all_transactions'),
      income: totalIncome.value,
      expense: totalExpense.value,
      balance: totalBalance.value,
      formatCurrency,
      getCategoryInfo,
      userName: currentUser.value?.displayName || currentUser.value?.email || null,
    })
    toast.success(t('toast_export_success'))
  } catch (e) {
    toast.error(t('toast_export_error'))
  } finally {
    isExportingPdf.value = false
  }
}

const handleExportCsv = () => {
  exportCsv()
  toast.success(t('toast_export_success'))
}

const handleBackupJson = () => {
  backupJson()
  toast.success(t('toast_backup_success'))
}

const triggerImport = () => importFileInput.value?.click()

const handleImportFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  isImporting.value = true
  try {
    await restoreJson(file)
    toast.success(t('toast_restore_success'))
  } catch (e) {
    toast.error(t('toast_restore_error'))
  } finally {
    isImporting.value = false
  }
}

// ── Danger Zone: Reset All Data ────────────────────────────────────────────────
const showResetDialog = ref(false)
const resetConfirmText = ref('')
const isResetting = ref(false)

const openResetDialog = () => {
  resetConfirmText.value = ''
  showResetDialog.value = true
}

const confirmReset = async () => {
  if (resetConfirmText.value !== 'DELETE' || isResetting.value) return
  isResetting.value = true
  try {
    await resetAllData()
    toast.success(t('toast_reset_success'))
    showResetDialog.value = false
    router.push('/')
  } catch (e) {
    toast.error(t('toast_reset_error'))
  } finally {
    isResetting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl mx-auto animate-fade-in">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('manage_preferences') }}</p>
    </div>

    <!-- ── Appearance ────────────────────────────────────────────────── -->
    <BaseCard>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('appearance') }}</h2>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center"
            :class="isDark ? 'bg-gray-700' : 'bg-amber-100'"
          >
            <span class="text-xl">{{ isDark ? '🌙' : '☀️' }}</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ isDark ? t('dark_mode') : t('light_mode') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('toggle_dark_mode_desc') }}</p>
          </div>
        </div>

        <button
          class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          :class="isDark ? 'bg-primary-600' : 'bg-gray-300'"
          aria-label="Toggle dark mode"
          @click="toggleTheme"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
            :class="isDark ? 'translate-x-6' : 'translate-x-1'"
          ></span>
        </button>
      </div>
    </BaseCard>

    <!-- ── Preferences ───────────────────────────────────────────────── -->
    <BaseCard>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('preferences') }}</h2>

      <div class="space-y-4">
        <!-- Language -->
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('language') }}</p>
          <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              :class="[
                'py-2 text-sm font-medium rounded-md transition-colors',
                locale === 'en' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              ]"
              @click="locale = 'en'"
            >{{ t('english') }}</button>
            <button
              :class="[
                'py-2 text-sm font-medium rounded-md transition-colors',
                locale === 'km' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              ]"
              @click="locale = 'km'"
            >{{ t('khmer') }}</button>
          </div>
        </div>

        <!-- Currency -->
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            {{ t('currency') }}
            <span v-if="currency === 'KHR'" class="ml-1 text-primary-500 font-semibold">1 USD = {{ USD_TO_KHR.toLocaleString() }} ៛</span>
          </p>
          <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              :class="[
                'py-2 text-sm font-medium rounded-md transition-colors',
                currency === 'USD' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              ]"
              @click="currency = 'USD'"
            >{{ t('usd') }}</button>
            <button
              :class="[
                'py-2 text-sm font-medium rounded-md transition-colors',
                currency === 'KHR' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              ]"
              @click="currency = 'KHR'"
            >{{ t('khr') }}</button>
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- ── General (Categories / Budget) ────────────────────────────────── -->
    <BaseCard padding="p-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white px-4 pt-4 pb-3">{{ t('general') }}</h2>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <button
          v-for="item in menuItems"
          :key="item.route"
          class="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          @click="router.push(item.route)"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              {{ item.icon }}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.label }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ item.description }}</p>
            </div>
          </div>
          <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </BaseCard>

    <!-- ── Network & Status ─────────────────────────────────────────────── -->
    <BaseCard padding="p-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white px-4 pt-4 pb-3">{{ t('network_status') }}</h2>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <!-- Live connection status -->
        <div class="flex items-center justify-between px-4 py-4">
          <div class="flex items-center gap-3">
            <span :class="['w-2.5 h-2.5 rounded-full shrink-0', isOnline ? 'bg-green-500' : 'bg-gray-400']"></span>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('connection') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ isOnline ? t('online') : t('offline') }}</p>
            </div>
          </div>
        </div>

        <!-- Offline mode preference (cosmetic — app already caches offline via PWA) -->
        <div class="flex items-center justify-between px-4 py-4">
          <div class="min-w-0 pr-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('offline_mode') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('offline_mode_desc') }}</p>
          </div>
          <button
            class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            :class="offlineModePref ? 'bg-primary-600' : 'bg-gray-300'"
            @click="offlineModePref = !offlineModePref"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
              :class="offlineModePref ? 'translate-x-6' : 'translate-x-1'"
            ></span>
          </button>
        </div>

        <!-- App version -->
        <div class="flex items-center justify-between px-4 py-4">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('app_version') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ APP_VERSION }}</p>
          </div>
          <button
            :disabled="checkingUpdate"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            @click="checkForUpdates"
          >
            {{ checkingUpdate ? t('checking') : t('check_for_updates') }}
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- ── Data Management ──────────────────────────────────────────────── -->
    <BaseCard>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{ t('data_management') }}</h2>
      <div class="grid grid-cols-2 gap-3">
        <button
          :disabled="isExportingPdf"
          class="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          @click="handleExportPdf"
        >
          <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ isExportingPdf ? t('exporting') : t('export_pdf') }}</span>
        </button>
        <button
          class="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click="handleExportCsv"
        >
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6L9 4H6a2 2 0 00-2 2z" />
          </svg>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('export_csv') }}</span>
        </button>
        <button
          class="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click="handleBackupJson"
        >
          <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('backup_json') }}</span>
        </button>
        <button
          :disabled="isImporting"
          class="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          @click="triggerImport"
        >
          <svg class="w-5 h-5 text-tertiary-600 dark:text-tertiary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ isImporting ? t('importing') : t('import_json') }}</span>
        </button>
      </div>
      <input ref="importFileInput" type="file" accept="application/json" class="hidden" @change="handleImportFile" />
    </BaseCard>

    <!-- ── Danger Zone ──────────────────────────────────────────────────── -->
    <BaseCard class="border-red-200 dark:border-red-900/50">
      <h2 class="text-base font-semibold text-red-600 dark:text-red-400 mb-2">{{ t('danger_zone') }}</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">{{ t('danger_zone_desc') }}</p>
      <button
        class="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors shadow-sm"
        @click="openResetDialog"
      >
        {{ t('reset_all_data') }}
      </button>
    </BaseCard>

    <!-- Reset confirmation modal -->
    <BaseModal :show="showResetDialog" :title="t('reset_all_data')" @close="showResetDialog = false">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('danger_zone_desc') }}</p>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('type_delete_to_confirm') }}</label>
          <input
            v-model="resetConfirmText"
            type="text"
            placeholder="DELETE"
            class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div class="flex gap-3 pt-1">
          <BaseButton variant="secondary" full-width @click="showResetDialog = false">{{ t('cancel') }}</BaseButton>
          <BaseButton
            variant="danger"
            full-width
            :disabled="resetConfirmText !== 'DELETE' || isResetting"
            @click="confirmReset"
          >
            {{ isResetting ? t('resetting') : t('reset_all_data') }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Credit -->
    <div class="flex flex-col items-center gap-1 pt-2 pb-1 select-none">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span class="text-sm font-bold text-gray-900 dark:text-white tracking-tight">FinanceFlow</span>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500">
        Made by <span class="text-primary-600 dark:text-primary-400 font-semibold">Soda MORN</span>
      </p>
    </div>

  </div>
</template>
