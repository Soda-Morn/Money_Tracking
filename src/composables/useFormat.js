/**
 * Composable for formatting utilities
 */
export function useFormat() {
  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
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

    if (dateOnly === todayOnly) return 'Today'
    if (dateOnly === yesterdayOnly) return 'Yesterday'
    return formatDate(dateString)
  }

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  // Get month name
  const getMonthName = (monthIndex) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[monthIndex]
  }

  return {
    formatCurrency,
    formatDate,
    formatRelativeDate,
    getCurrentDate,
    getMonthName
  }
}
