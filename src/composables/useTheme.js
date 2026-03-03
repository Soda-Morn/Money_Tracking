import { ref } from 'vue'

const isDark = ref(
  typeof window !== 'undefined'
    ? localStorage.getItem('theme') === 'dark'
    : false
)

// Apply initial class immediately on module load
if (typeof window !== 'undefined') {
  document.documentElement.classList.toggle('dark', isDark.value)
}

export function useTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('dark', isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggleTheme }
}
