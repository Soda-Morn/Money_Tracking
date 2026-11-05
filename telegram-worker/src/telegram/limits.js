/**
 * Daily & weekly spending limits in the bot (rules: src/shared/limits.js).
 *
 *  - limitLines()      "🎯 Food today: $3.00 left" lines for /today, /budget and
 *                      the "Saved" message
 *  - afterExpense()    status + alert text to append after an expense is saved
 *  - runLimitAlerts()  cron: alerts for expenses added in the APP (or anywhere)
 *
 * Every alert key is stored in users/{uid}/settings/limitAlerts so the app-
 * independent cron and the instant reply never send the same alert twice.
 */
import { limitUsage, pendingAlerts, alertKey, pruneAlertKeys, weekRange, normalizeLimits, hasAnyLimit } from '../../../src/shared/limits.js'
import { categoryInfo } from '../../../src/shared/categories.js'
import { esc, money, catEmoji, todayIn } from './messages.js'

const scopeLabel = (row, cats) => {
  if (row.scope === 'total') return '💸 All spending'
  const info = categoryInfo(row.scope, 'expense', cats)
  return `${catEmoji(info.icon)} ${esc(info.label)}`
}
const when = (row) => (row.period === 'day' ? 'today' : 'this week')

export const alertsOn = (settings) => settings?.limitAlerts !== false

/** One status line: "🍔 Food today: $3.00 left of $10.00" */
export function statusLine(row, cats, currency) {
  const icon = row.level === 'over' ? '🔴' : row.level === 'warn' ? '🟠' : '🟢'
  const rest = row.remaining < 0
    ? `<b>over by ${money(-row.remaining, currency)}</b>`
    : `${money(row.remaining, currency)} left`
  const until = row.to ? ` <i>(until ${shortDate(row.to)})</i>` : ''
  return `${icon} ${scopeLabel(row, cats)} ${when(row)}: ${rest} of ${money(row.limit, currency)}${until}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`

/** Alert text for one row reaching 80 % / 100 %. */
export function alertLine(row, cats, currency) {
  return row.level === 'over'
    ? `🚨 <b>Over your limit</b> — ${scopeLabel(row, cats)} ${when(row)}: spent ${money(row.spent, currency)} of ${money(row.limit, currency)}`
    : `⚠️ <b>${row.pct}% of your limit used</b> — ${scopeLabel(row, cats)} ${when(row)}: ${money(row.remaining, currency)} left`
}

/** Expenses needed to evaluate every limit for `today` (this week so far). */
const weekTransactions = (data, uid, today) =>
  data.transactionsBetween(uid, weekRange(today).start, today)

/** Current usage rows, or [] when the user has no limits. */
export async function usageFor(ctx, limitsDoc) {
  const doc = limitsDoc === undefined ? await ctx.data.spendingLimits(ctx.uid) : limitsDoc
  if (!doc || !hasAnyLimit(normalizeLimits(doc))) return []
  return limitUsage(doc, await weekTransactions(ctx.data, ctx.uid, ctx.today), ctx.today)
}

/**
 * Text to append after an EXPENSE was saved: alerts that newly fire (and are
 * recorded as sent), plus the status of limits this expense counts towards.
 * Returns '' when the user has no limits.
 */
export async function afterExpense(ctx, tx, cats, limitsDoc) {
  if (tx.type !== 'expense' || !limitsDoc) return ''
  const rows = (await usageFor(ctx, limitsDoc)).filter((r) => r.scope === 'total' || r.scope === tx.category)
  if (!rows.length) return ''
  let fresh = []
  if (alertsOn(ctx.settings)) {
    const sent = (await ctx.data.limitAlertKeys(ctx.uid)) || []
    fresh = pendingAlerts(rows, sent)
    // Awaited (only when an alert fires) so a quick second save or the cron
    // can't send the same alert again
    if (fresh.length) await ctx.data.saveLimitAlertKeys(ctx.uid, pruneAlertKeys([...sent, ...fresh.map(alertKey)], ctx.today))
  }
  const alerted = new Set(fresh.map((r) => r.period + r.scope))
  const lines = [
    ...fresh.map((r) => alertLine(r, cats, ctx.currency)),
    ...rows.filter((r) => !alerted.has(r.period + r.scope)).map((r) => statusLine(r, cats, ctx.currency)),
  ]
  return `\n\n${lines.join('\n')}`
}

/** Status block for /today and /budget (periods filter: ['day'] or both). */
export async function limitLines(ctx, cats, periods = ['day', 'week'], limitsDoc) {
  const rows = (await usageFor(ctx, limitsDoc)).filter((r) => periods.includes(r.period))
  return rows.map((r) => statusLine(r, cats, ctx.currency))
}

/**
 * Cron: for each verified, connected user with limits and alerts on, send
 * alerts that haven't been sent yet (covers expenses added in the app).
 * `verifyLink(id, link)` must return the uid only if the HMAC signature holds.
 */
export async function runLimitAlerts({ fs, data, tg, env }, verifyLink, now = new Date()) {
  const links = await fs.list('telegramLinks')
  let sentCount = 0
  for (const link of links) {
    try {
      const uid = await verifyLink(link.id, link)
      if (!uid) continue
      const [settings, limitsDoc, prefs, alertsDoc] = await fs.batchGet([
        `users/${uid}/settings/telegram`,
        `users/${uid}/settings/spendingLimits`,
        `users/${uid}/settings/preferences`,
        `users/${uid}/settings/limitAlerts`,
      ])
      // Still connected to THIS Telegram user, alerts on, and has limits?
      if (!settings || String(settings.telegramUserId) !== String(link.id) || !alertsOn(settings)) continue
      if (!limitsDoc || !hasAnyLimit(normalizeLimits(limitsDoc))) continue

      const today = todayIn(settings.timezone || env.DEFAULT_TIMEZONE || 'UTC', now)
      const txs = await data.transactionsBetween(uid, weekRange(today).start, today)
      const sent = alertsDoc?.keys || []
      const fresh = pendingAlerts(limitUsage(limitsDoc, txs, today), sent)
      if (!fresh.length) continue

      // Record first: a failed send is better than a repeated one every run
      await data.saveLimitAlertKeys(uid, pruneAlertKeys([...sent, ...fresh.map(alertKey)], today))
      const cats = await data.categories(uid, 'expense')
      const currency = prefs?.currency === 'KHR' ? 'KHR' : 'USD'
      await tg.send(link.id, `${fresh.map((r) => alertLine(r, cats, currency)).join('\n')}\n\n<i>Spending limits · /budget</i>`)
      sentCount += fresh.length
    } catch (e) {
      console.error(JSON.stringify({ event: 'limit_alert_failed', error: e?.message?.slice(0, 120) }))
    }
  }
  console.log(JSON.stringify({ event: 'limit_alerts_run', users: links.length, sent: sentCount }))
  return sentCount
}
