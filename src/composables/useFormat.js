/**
 * Composable for formatting utilities
 */
import { useI18n } from 'vue-i18n'
import { useCurrency } from './useCurrency'

// Comparator for sorting objects with a 'YYYY-MM-DD' `date` field, newest first.
// Plain function (not part of useFormat()) since it needs no reactive i18n/currency state.
export const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

// Date → 'YYYY-MM-DD' in the user's LOCAL timezone.
// Never use toISOString() for this: it is UTC, so in Cambodia (UTC+7) any time
// between 00:00 and 07:00 would produce yesterday's date.
export const toLocalDateString = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 'YYYY-MM-DD' → Date at LOCAL midnight. `new Date('2026-11-05')` parses as UTC,
// which can shift the day in some timezones. Full timestamps are parsed as-is.
const parseDate = (value) => {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function useFormat() {
  const { locale, t } = useI18n()
  const { currency, convertAmount } = useCurrency()

  // Format currency — converts from USD storage value to the selected display currency
  const formatCurrency = (amount) => {
    const displayAmount = convertAmount(amount)
    if (currency.value === 'KHR') {
      return new Intl.NumberFormat(locale.value || 'en-US', {
        style: 'currency',
        currency: 'KHR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(displayAmount)
    }
    return new Intl.NumberFormat(locale.value || 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(displayAmount)
  }

  // Format date for display
  const formatDate = (dateString) => {
    const date = parseDate(dateString)
    return date.toLocaleDateString(locale.value || 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Format date as relative (Today, Yesterday, etc.)
  const formatRelativeDate = (dateString) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const dateOnly = toLocalDateString(parseDate(dateString))
    const todayOnly = toLocalDateString(today)
    const yesterdayOnly = toLocalDateString(yesterday)

    if (dateOnly === todayOnly) return t('today')
    if (dateOnly === yesterdayOnly) return t('yesterday')
    return formatDate(dateString)
  }

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    return toLocalDateString(new Date())
  }

  // Get month name (localized)
  const getMonthName = (monthIndex) => {
    const date = new Date(2000, monthIndex, 1)
    return date.toLocaleDateString(locale.value || 'en-US', { month: 'long' })
  }

  return {
    formatCurrency,
    formatDate,
    formatRelativeDate,
    getCurrentDate,
    getMonthName
  }
}
