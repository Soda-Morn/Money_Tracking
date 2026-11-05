import { ref } from 'vue'

// Global "add transaction" sheet state — opened from the bottom-nav "+" button,
// the desktop sidebar, and dashboard quick actions. Rendered once in App.vue.
const isOpen = ref(false)
const type = ref('expense') // 'expense' | 'income' | 'lending'

export function useQuickAdd() {
  const open = (initialType = 'expense') => {
    type.value = initialType
    isOpen.value = true
  }
  const close = () => { isOpen.value = false }
  return { isOpen, type, open, close }
}
