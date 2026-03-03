<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCategories } from '../composables/useCategories'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const router = useRouter()
const { expenseCategories, incomeCategories, addCategory, deleteCategory } = useCategories()

const activeTab = ref('expense')
const expandedCategory = ref(null)
const showAddModal = ref(false)
const isAdding = ref(false)

const addForm = ref({ label: '', icon: '📌', type: 'expense' })

const emojiOptions = [
  '🍔', '🍕', '🍜', '🍣', '🥗', '🍰', '☕', '🥤', '🍺', '🥩',
  '🚗', '🚌', '🚲', '✈️', '🚂', '🛵', '🚕', '🛳️',
  '🛍️', '👗', '💎', '🛒', '👟', '🕶️',
  '📄', '🏠', '💡', '📱', '💳', '🔑',
  '🏥', '💊', '🏃', '🧘', '💪', '🦷',
  '🎬', '🎮', '🎵', '🎭', '🎪', '🎲',
  '📚', '📖', '🎓', '✏️', '🔬', '🖥️',
  '💼', '💰', '📈', '🏦', '💵', '🤝',
  '🎯', '⭐', '🎁', '🌟', '✨', '❤️', '🔥', '🏆',
  '🌿', '🐶', '🐱', '🎉', '🎂', '🌈', '📌', '⚡'
]

const currentCategories = computed(() =>
  activeTab.value === 'expense' ? expenseCategories.value : incomeCategories.value
)

const toggleExpanded = (value) => {
  expandedCategory.value = expandedCategory.value === value ? null : value
}

const openAddModal = () => {
  addForm.value = { label: '', icon: '📌', type: activeTab.value }
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
        @click="router.back()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your transaction categories</p>
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
            {{ tab === 'expense' ? '💸 Expense' : '💵 Income' }}
          </button>
        </div>

        <!-- Add button -->
        <button
          class="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          @click="openAddModal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
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
              <span class="text-xl">{{ cat.icon }}</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ cat.label }}</span>
            </div>
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0"
              :class="expandedCategory === cat.value ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Expanded detail row -->
          <div
            v-if="expandedCategory === cat.value"
            class="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ cat.icon }}</span>
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ cat.label }}</p>
                <span
                  class="text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="cat.isDefault
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                    : 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'"
                >
                  {{ cat.isDefault ? 'Default' : 'Custom' }}
                </span>
              </div>
            </div>

            <!-- Delete (custom only) -->
            <button
              v-if="!cat.isDefault"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
              @click="handleDelete(cat.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <span v-else class="text-xs text-gray-400 dark:text-gray-500 shrink-0">Cannot delete</span>
          </div>

        </div>
      </div>
    </BaseCard>

    <!-- Add Category Modal -->
    <BaseModal :show="showAddModal" title="Add Category" @close="showAddModal = false">
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
            {{ type === 'expense' ? '💸 Expense' : '💵 Income' }}
          </button>
        </div>

        <!-- Name -->
        <BaseInput
          v-model="addForm.label"
          label="Category Name"
          placeholder="e.g., Gym, Pet Care, Side Income..."
          :required="true"
        />

        <!-- Emoji picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Choose Icon</label>
          <div class="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <button
              v-for="emoji in emojiOptions"
              :key="emoji"
              type="button"
              :class="[
                'w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-colors',
                addForm.icon === emoji
                  ? 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-500'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              ]"
              @click="addForm.icon = emoji"
            >
              {{ emoji }}
            </button>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500 dark:text-gray-400">Or type custom icon:</span>
            <input
              v-model="addForm.icon"
              maxlength="2"
              class="w-14 h-10 text-center text-2xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="😀"
            />
          </div>
        </div>

        <!-- Preview -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <span class="text-3xl">{{ addForm.icon }}</span>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ addForm.label || 'Category Name' }}</p>
            <p class="text-xs text-gray-400 capitalize">{{ addForm.type }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <BaseButton variant="secondary" @click="showAddModal = false" full-width>Cancel</BaseButton>
          <BaseButton :disabled="!addForm.label.trim() || isAdding" @click="handleAddCategory" full-width>
            {{ isAdding ? 'Adding...' : 'Add Category' }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
