<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCategories } from '../composables/useCategories'
import { useI18n } from 'vue-i18n'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import IconPicker from '../components/ui/IconPicker.vue'
import { CATEGORY_ICON_KEYS } from '../icons'
import { ChevronLeft, ChevronDown, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-vue-next'

const { t } = useI18n()

const router = useRouter()
const { expenseCategories, incomeCategories, addCategory, deleteCategory } = useCategories()

const activeTab = ref('expense')
const expandedCategory = ref(null)
const showAddModal = ref(false)
const isAdding = ref(false)

const addForm = ref({ label: '', icon: 'tag', type: 'expense' })

const currentCategories = computed(() =>
  activeTab.value === 'expense' ? expenseCategories.value : incomeCategories.value
)

const toggleExpanded = (value) => {
  expandedCategory.value = expandedCategory.value === value ? null : value
}

const openAddModal = () => {
  addForm.value = { label: '', icon: 'tag', type: activeTab.value }
  showAddModal.value = true
}

const handleAddCategory = async () => {
  if (!addForm.value.label.trim()) return
  isAdding.value = true
  try {
    await addCategory(addForm.value)
    showAddModal.value = false
  } finally {
    isAdding.value = false
  }
}

const handleDelete = async (id) => {
  expandedCategory.value = null
  await deleteCategory(id)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl mx-auto animate-fade-in">

    <!-- Page header with back button -->
    <div class="flex items-center gap-3">
      <button
        class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        :aria-label="t('back')"
        @click="router.back()"
      >
        <AppIcon :icon="ChevronLeft" size="nav" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('categories') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('manage_transaction_categories') }}</p>
      </div>
    </div>

    <BaseCard padding="p-0">
      <!-- Card header: tabs + Add button -->
      <div class="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <!-- Expense / Income tabs -->
        <div class="flex gap-1 flex-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            v-for="tab in ['expense', 'income']"
            :key="tab"
            :class="[
              'flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            ]"
            @click="activeTab = tab; expandedCategory = null"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <AppIcon
                :icon="tab === 'expense' ? TrendingDown : TrendingUp"
                size="action"
                :class="tab === 'expense' ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
              />
              {{ tab === 'expense' ? t('expense') : t('income') }}
            </span>
          </button>
        </div>

        <!-- Add button -->
        <button
          class="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          @click="openAddModal"
        >
          <AppIcon :icon="Plus" size="action" />
          {{ t('add') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="currentCategories.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          :class="activeTab === 'expense'
            ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'"
        >
          <AppIcon :icon="activeTab === 'expense' ? TrendingDown : TrendingUp" size="hero" />
        </div>
        <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">No categories yet</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Tap <strong>+ Add</strong> to create your first category</p>
      </div>

      <!-- Category list — accordion -->
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="cat in currentCategories" :key="cat.value">

          <!-- Collapsed row: icon + name + chevron -->
          <button
            class="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            @click="toggleExpanded(cat.value)"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                :class="activeTab === 'expense'
                  ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'"
              >
                <AppIcon :name="cat.icon" fallback="tag" size="button" />
              </div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ cat.label }}</span>
            </div>
            <AppIcon
              :icon="ChevronDown"
              size="action"
              class="text-gray-400 transition-transform duration-200"
              :class="expandedCategory === cat.value ? 'rotate-180' : ''"
            />
          </button>

          <!-- Expanded detail row -->
          <div
            v-if="expandedCategory === cat.value"
            class="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                :class="activeTab === 'expense'
                  ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'"
              >
                <AppIcon :name="cat.icon" fallback="tag" size="card" />
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ cat.label }}</p>
            </div>

            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
              @click="handleDelete(cat.id)"
            >
              <AppIcon :icon="Trash2" size="action" />
              {{ t('delete') }}
            </button>
          </div>

        </div>
      </div>
    </BaseCard>

    <!-- Add Category Modal -->
    <BaseModal :show="showAddModal" :title="t('add_category')" @close="showAddModal = false">
      <div class="space-y-4">
        <!-- Expense / Income toggle -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <button
            v-for="type in ['expense', 'income']"
            :key="type"
            type="button"
            :class="[
              'py-2 px-3 rounded-md text-sm font-medium transition-colors',
              addForm.type === type
                ? type === 'expense'
                  ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm'
                  : 'bg-white dark:bg-gray-600 text-green-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="addForm.type = type"
          >
            <span class="inline-flex items-center justify-center gap-1.5">
              <AppIcon
                :icon="type === 'expense' ? TrendingDown : TrendingUp"
                size="action"
                :class="type === 'expense' ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
              />
              {{ type === 'expense' ? t('expense') : t('income') }}
            </span>
          </button>
        </div>

        <!-- Name -->
        <BaseInput
          v-model="addForm.label"
          :label="t('category_name')"
          placeholder="e.g., Gym, Pet Care, Side Income..."
          :required="true"
        />

        <!-- Icon picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('icon_label') }}</label>
          <IconPicker v-model="addForm.icon" :options="CATEGORY_ICON_KEYS" :label="t('icon_label')" />
        </div>

        <!-- Preview -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            :class="addForm.type === 'expense'
              ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'"
          >
            <AppIcon :name="addForm.icon" fallback="tag" size="card" />
          </div>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ addForm.label || t('category_name') }}</p>
            <p class="text-xs text-gray-400 capitalize">{{ t(addForm.type) }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <BaseButton variant="secondary" @click="showAddModal = false" full-width>{{ t('cancel') }}</BaseButton>
          <BaseButton :disabled="!addForm.label.trim() || isAdding" @click="handleAddCategory" full-width>
            {{ isAdding ? t('loading') : t('add_category') }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
