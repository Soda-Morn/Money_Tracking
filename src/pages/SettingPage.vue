<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import { useCurrency, USD_TO_KHR } from '../composables/useCurrency'

import BaseCard from '../components/ui/BaseCard.vue'

const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const { locale } = useLanguage()
const { currency } = useCurrency()

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

        <!-- iOS-style toggle -->
        <button
          class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          :class="isDark ? 'bg-blue-600' : 'bg-gray-300'"
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

    <!-- ── General ────────────────────────────────────────────────────── -->
    <BaseCard padding="p-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white px-4 pt-4 pb-3">{{ t('general') }}</h2>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <!-- language selector -->
        <div class="w-full flex items-center justify-between px-4 py-4 text-left">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              🌐
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('language') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('choose_language_desc') }}</p>
            </div>
          </div>
          <select
            v-model="locale"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="en">{{ t('english') }}</option>
            <option value="km">{{ t('khmer') }}</option>
          </select>
        </div>

        <!-- currency selector -->
        <div class="w-full flex items-center justify-between px-4 py-4 text-left">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg shrink-0">
              💵
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('currency') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ t('choose_currency_desc') }}
                <span v-if="currency === 'KHR'" class="ml-1 text-blue-500">1 USD = {{ USD_TO_KHR.toLocaleString() }} ៛</span>
              </p>
            </div>
          </div>
          <select
            v-model="currency"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USD">{{ t('usd') }}</option>
            <option value="KHR">{{ t('khr') }}</option>
          </select>
        </div>

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

    <!-- Credit -->
    <div class="flex flex-col items-center gap-1 pt-2 pb-1 select-none">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span class="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Money Tracking</span>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500">
        Made by <span class="text-blue-600 dark:text-blue-400 font-semibold">Soda MORN</span>
      </p>
    </div>

  </div>
</template>
