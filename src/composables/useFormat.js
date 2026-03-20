/**
 * Composable for formatting utilities
 */
import { useI18n } from 'vue-i18n'
import { useCurrency } from './useCurrency'

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
    const date = new Date(dateString)
    return date.toLocaleDateString(locale.value || 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Format date as relative (Today, Yesterday, etc.)
  const formatRelativeDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const dateOnly = dateString.split('T')[0]
    const todayOnly = today.toISOString().split('T')[0]
    const yesterdayOnly = yesterday.toISOString().split('T')[0]

    if (dateOnly === todayOnly) return t('today')
    if (dateOnly === yesterdayOnly) return t('yesterday')
    return formatDate(dateString)
  }

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0]
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
