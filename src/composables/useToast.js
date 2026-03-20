import { ref } from 'vue'

// Module-level singleton — shared across the whole app
const toasts = ref([])
let nextId = 0

export function useToast() {
  const show = (message, type = 'success', duration = 3000) => {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => remove(id), duration)
  }

  const success = (message) => show(message, 'success')
  const error   = (message) => show(message, 'error')
  const info    = (message) => show(message, 'info')

  const remove = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, success, error, info, remove }
}
