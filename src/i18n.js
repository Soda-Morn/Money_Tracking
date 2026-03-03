import { createI18n } from 'vue-i18n'

// load message files
// for simplicity we require the JSON directly which Vite will bundle
import en from './locales/en.json'
import km from './locales/km.json'

// detect stored locale or fall back to browser default / english
const defaultLocale = localStorage.getItem('locale') || 'en'

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    km
  }
})

export default i18n
