import { useI18n } from 'vue-i18n'

/** Human wording for a limit's active dates ("Nov 5 – Nov 20", "Starts Nov 20", …). */
export function useLimitText() {
  const { t, locale } = useI18n()
  const short = (d) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString(locale.value || 'en-US', { month: 'short', day: 'numeric' })
  }
  /** '' when the limit has no dates (applies every day / week). */
  const rangeText = (row) => {
    if (!row?.from && !row?.to) return ''
    if (row.from && row.to) return t('budget_page.range', { from: short(row.from), to: short(row.to) })
    return row.from ? t('budget_page.from_date', { date: short(row.from) }) : t('budget_page.until_date', { date: short(row.to) })
  }
  /** '' while the limit counts today. */
  const inactiveText = (row) => {
    if (row?.status === 'upcoming') return t('budget_page.starts', { date: short(row.from) })
    if (row?.status === 'ended') return t('budget_page.ended')
    return ''
  }
  return { rangeText, inactiveText, short }
}
