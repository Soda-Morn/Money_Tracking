<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LendingTab from '../components/loans/LendingTab.vue'
import MyLoansTab from '../components/loans/MyLoansTab.vue'

const { t } = useI18n()
const activeTab = ref('lending') // 'lending' | 'myLoans'
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('pages.borrow') }}</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">{{ t('loans_page_desc') }}</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg max-w-md">
      <button
        :class="[
          'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
          activeTab === 'lending'
            ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        ]"
        @click="activeTab = 'lending'"
      >
        🤝 {{ t('lending_tab') }}
      </button>
      <button
        :class="[
          'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
          activeTab === 'myLoans'
            ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        ]"
        @click="activeTab = 'myLoans'"
      >
        💳 {{ t('my_loans_tab') }}
      </button>
    </div>

    <LendingTab v-if="activeTab === 'lending'" />
    <MyLoansTab v-else />
  </div>
</template>
