import { useI18n } from 'vue-i18n'
import { watch } from 'vue'

export function useLanguage() {
  const { locale } = useI18n()

  // persist changes
  watch(locale, (newVal) => {
    localStorage.setItem('locale', newVal)
  })

  const setLanguage = (lang) => {
    locale.value = lang
  }

  return {
    locale,
    setLanguage
  }
}
