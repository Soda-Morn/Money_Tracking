import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { createApp, h } from 'vue'
import { TrendingUp, TrendingDown, Wallet, HandCoins, Handshake, Receipt, PiggyBank, Trophy, Heart } from 'lucide-vue-next'
import { resolveIcon } from '../icons'
import { totals, savingsRate } from '../shared/finance'

/*
 * PDF report = HTML pages (A4 @ 96dpi = 794 × 1123 px) → html2canvas → jsPDF.
 * HTML (not jsPDF text) is used on purpose: the browser shapes Khmer text
 * correctly, jsPDF cannot.
 */

const PAGE_W = 794
const PAGE_H = 1123
const FONT = `'Inter','Kantumruy Pro','Segoe UI','Khmer UI',Arial,sans-serif`

// Rows per page. Rows have a fixed height, so these are safe; anything that
// still overflows is scaled down to fit the page instead of being cut off.
const ROWS_P1_WITH_BREAKDOWN = 12
const ROWS_P1 = 16
const ROWS_REST = 21

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  brand: '#0a3d33', brand2: '#0d4d40', mint: '#eaf4f1', mintLine: '#cde6dd',
  ink: '#111827', text: '#374151', muted: '#6b7280', faint: '#9ca3af', line: '#eef0f3',
  zebra: '#fafbfc',
}

const TYPE_STYLE = {
  income:  { label: 'Income',   sign: '+', amount: '#15803d', soft: '#dcfce7', dark: '#166534', dot: '#22c55e' },
  expense: { label: 'Expense',  sign: '−', amount: '#be123c', soft: '#ffe4e6', dark: '#9f1239', dot: '#f43f5e' },
  borrow:  { label: 'Borrowed', sign: '+', amount: '#0e7490', soft: '#cffafe', dark: '#155e75', dot: '#06b6d4' },
  payback: { label: 'Repaid',   sign: '−', amount: '#b45309', soft: '#fef3c7', dark: '#92400e', dot: '#f59e0b' },
}

// Soft colours for the category bars (expense breakdown)
const BAR_COLORS = ['#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#94a3b8']

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const amountOf = (tx) => Number(tx?.amount) || 0

/** 'YYYY-MM-DD' → { main: 'Nov 5, 2026', day: 'Thu' } (local calendar, no TZ shift). */
function formatDay(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number)
  if (!y || !m || !d) return { main: esc(dateStr || '—'), day: '' }
  const date = new Date(y, m - 1, d)
  return {
    main: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

// Lucide component → inline SVG string (cached). Colour must be explicit:
// html2canvas renders each SVG as an isolated image, so `currentColor` is lost.
const svgCache = new WeakMap() // component → Map(variant → svg string)
function svg(component, size, color, strokeWidth = 2) {
  if (!svgCache.has(component)) svgCache.set(component, new Map())
  const cache = svgCache.get(component)
  const key = `${size}|${color}|${strokeWidth}`
  if (cache.has(key)) return cache.get(key)
  const el = document.createElement('div')
  const app = createApp({ render: () => h(component, { size, color, strokeWidth }) })
  app.mount(el)
  const out = el.innerHTML
  app.unmount()
  cache.set(key, out)
  return out
}

function iconBubble(component, color, bg, box = 30, size = 16) {
  return `<div style="width:${box}px;height:${box}px;border-radius:${Math.round(box / 3)}px;background:${bg};
    display:flex;align-items:center;justify-content:center;flex-shrink:0;">${svg(component, size, color)}</div>`
}

/** Category label + icon for a row. Borrow / payback have no category. */
function categoryOf(tx, getCategoryInfo) {
  if (tx.type === 'borrow')  return { label: 'Loan received', icon: HandCoins }
  if (tx.type === 'payback') return { label: 'Loan repayment', icon: Handshake }
  const cat = getCategoryInfo(tx.category, tx.type) || {}
  return { label: cat.label || tx.category || 'Other', icon: resolveIcon(cat.icon) }
}

/** Expense total per category, biggest first; the tail is merged into "Others". */
function expenseBreakdown(transactions, getCategoryInfo, max = 5) {
  const map = new Map()
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const cat = categoryOf(tx, getCategoryInfo)
    const row = map.get(cat.label) || { ...cat, total: 0, count: 0 }
    row.total += amountOf(tx)
    row.count += 1
    map.set(cat.label, row)
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total)
  if (list.length <= max) return list
  const rest = list.slice(max - 1)
  return [
    ...list.slice(0, max - 1),
    { label: `Others (${rest.length})`, icon: resolveIcon('tag'), total: rest.reduce((s, r) => s + r.total, 0), count: rest.reduce((s, r) => s + r.count, 0) },
  ]
}

// ── Page frame (fixed A4 height, footer pinned to the bottom) ─────────────────
function pageFrame(inner, pageNum, totalPages) {
  return `
    <div style="width:${PAGE_W}px;min-height:${PAGE_H}px;background:#ffffff;font-family:${FONT};
      color:${C.ink};box-sizing:border-box;display:flex;flex-direction:column;">
      <div style="flex:1;">${inner}</div>
      <div style="padding:14px 36px 22px;">
        <div style="border-top:1px solid ${C.line};padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:${C.faint};">
            ${svg(Heart, 11, '#f43f5e', 2.25)}
            <span>FinanceFlow &nbsp;·&nbsp; Made by <strong style="color:${C.brand2};font-weight:600;">Soda MORN</strong></span>
          </div>
          <span style="font-size:10px;color:${C.faint};font-weight:600;">Page ${pageNum} of ${totalPages}</span>
        </div>
      </div>
    </div>`
}

// ── Header (page 1) ───────────────────────────────────────────────────────────
function header({ monthLabel, userName }) {
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return `
    <div style="background:linear-gradient(120deg,#082f27 0%,#0d4d40 60%,#1f6b5a 100%);padding:28px 36px 30px;
      position:relative;overflow:hidden;">
      <div style="position:absolute;top:-60px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
      <div style="position:absolute;bottom:-70px;right:150px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>

      <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${iconBubble(Wallet, '#ffffff', 'rgba(255,255,255,0.16)', 34, 18)}
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">FinanceFlow</span>
          </div>
          <div style="margin-top:18px;color:#9ccdbe;font-size:10px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;">Transaction Report</div>
          <div style="margin-top:4px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;line-height:1.25;">${esc(monthLabel || 'All transactions')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 14px;min-width:170px;">
          <div style="color:#9ccdbe;font-size:9px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Generated</div>
          <div style="color:#ffffff;font-size:11px;font-weight:600;margin-top:2px;">${generated}</div>
          ${userName ? `
          <div style="color:#9ccdbe;font-size:9px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin-top:8px;">Prepared for</div>
          <div style="color:#ffffff;font-size:11px;font-weight:600;margin-top:2px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(userName)}</div>` : ''}
        </div>
      </div>
    </div>`
}

// ── Summary cards ─────────────────────────────────────────────────────────────
function summaryCard({ title, value, valueColor, sub, icon, iconColor, iconBg, bg, border }) {
  return `
    <div style="flex:1;background:${bg};border:1px solid ${border};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;font-weight:600;color:${C.muted};letter-spacing:0.6px;text-transform:uppercase;">${title}</span>
        ${iconBubble(icon, iconColor, iconBg, 26, 14)}
      </div>
      <div style="margin-top:6px;font-size:21px;font-weight:700;color:${valueColor};letter-spacing:-0.4px;white-space:nowrap;">${value}</div>
      <div style="margin-top:4px;font-size:10px;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>
    </div>`
}

function summary(stats, fmt) {
  const { income, expense, borrow, payback, balance, counts } = stats
  const plural = (n) => `${n} transaction${n === 1 ? '' : 's'}`
  const loanNote = borrow || payback
    ? `Incl. borrowed ${fmt(borrow)} · repaid ${fmt(payback)}`
    : 'Income − expense'
  return `
    <div style="display:flex;gap:14px;padding:22px 36px 0;">
      ${summaryCard({
        title: 'Total income', value: fmt(income), valueColor: TYPE_STYLE.income.amount, sub: plural(counts.income),
        icon: TrendingUp, iconColor: TYPE_STYLE.income.amount, iconBg: TYPE_STYLE.income.soft, bg: '#f7fdf9', border: '#d1fae5',
      })}
      ${summaryCard({
        title: 'Total expense', value: fmt(expense), valueColor: TYPE_STYLE.expense.amount, sub: plural(counts.expense),
        icon: TrendingDown, iconColor: TYPE_STYLE.expense.amount, iconBg: TYPE_STYLE.expense.soft, bg: '#fffafa', border: '#ffe4e6',
      })}
      ${summaryCard({
        title: 'Net balance', value: fmt(balance), valueColor: balance >= 0 ? C.brand2 : TYPE_STYLE.expense.amount, sub: loanNote,
        icon: Wallet, iconColor: C.brand2, iconBg: C.mintLine, bg: C.mint, border: C.mintLine,
      })}
    </div>`
}

// ── Spending by category + quick stats (page 1) ───────────────────────────────
function sectionTitle(text, right = '') {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:13px;font-weight:700;color:${C.ink};">${text}</span>${right}
    </div>`
}

function insights(stats, breakdown, fmt) {
  const { income, expense, counts, largest } = stats
  const rate = savingsRate(income, expense)

  const bars = breakdown.map((row, i) => {
    const pct = expense ? Math.round((row.total / expense) * 100) : 0
    const color = BAR_COLORS[i % BAR_COLORS.length]
    return `
      <div style="display:flex;align-items:center;gap:10px;height:26px;">
        ${iconBubble(row.icon, color, `${color}1f`, 22, 12)}
        <span style="width:130px;font-size:11px;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(row.label)}</span>
        <div style="flex:1;height:8px;border-radius:99px;background:#f1f3f5;overflow:hidden;">
          <div style="width:${Math.max(pct, 2)}%;height:8px;border-radius:99px;background:${color};"></div>
        </div>
        <span style="width:34px;text-align:right;font-size:10px;color:${C.muted};">${pct}%</span>
        <span style="width:74px;text-align:right;font-size:11px;font-weight:600;color:${C.ink};white-space:nowrap;">${fmt(row.total)}</span>
      </div>`
  }).join('')

  const stat = (icon, color, bg, label, value) => `
    <div style="display:flex;align-items:center;gap:10px;height:40px;">
      ${iconBubble(icon, color, bg, 28, 14)}
      <div style="min-width:0;">
        <div style="font-size:9.5px;color:${C.muted};">${label}</div>
        <div style="font-size:12px;font-weight:700;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${value}</div>
      </div>
    </div>`

  return `
    <div style="display:flex;gap:14px;padding:16px 36px 0;">
      <div style="flex:1;border:1px solid ${C.line};border-radius:14px;padding:14px 16px;">
        ${sectionTitle('Spending by category', `<span style="font-size:10px;color:${C.faint};">Share of total expense</span>`)}
        ${bars}
      </div>
      <div style="width:210px;border:1px solid ${C.line};border-radius:14px;padding:14px 16px;">
        ${sectionTitle('Quick stats')}
        ${stat(Receipt, C.brand2, C.mint, 'Transactions', counts.all)}
        ${stat(PiggyBank, '#7c3aed', '#ede9fe', 'Savings rate', rate === null ? '—' : `${rate}%`)}
        ${stat(Trophy, '#b45309', '#fef3c7', 'Largest expense', largest ? `${fmt(amountOf(largest))}` : '—')}
      </div>
    </div>`
}

// ── Transactions table ────────────────────────────────────────────────────────
const TH = `padding:0 12px;height:34px;font-size:9.5px;font-weight:600;color:${C.muted};
  letter-spacing:0.6px;text-transform:uppercase;background:#f6f7f9;border-bottom:1px solid ${C.line};text-align:left;`
const TD = `padding:0 12px;height:40px;font-size:11px;border-bottom:1px solid ${C.line};vertical-align:middle;`

function table(rowsHtml, footHtml = '') {
  return `
    <div style="border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup>
          <col style="width:38px"><col style="width:104px"><col><col style="width:150px">
          <col style="width:92px"><col style="width:104px">
        </colgroup>
        <thead>
          <tr>
            <th style="${TH}text-align:center;">#</th>
            <th style="${TH}">Date</th>
            <th style="${TH}">Description</th>
            <th style="${TH}">Category</th>
            <th style="${TH}text-align:center;">Type</th>
            <th style="${TH}text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        ${footHtml}
      </table>
    </div>`
}

function rows(chunk, offset, getCategoryInfo, fmt) {
  if (!chunk.length) {
    return `<tr><td colspan="6" style="padding:40px 12px;text-align:center;color:${C.faint};font-size:12px;">
      No transactions in this period</td></tr>`
  }
  return chunk.map((tx, i) => {
    const s = TYPE_STYLE[tx.type] || TYPE_STYLE.expense
    const cat = categoryOf(tx, getCategoryInfo)
    const day = formatDay(tx.date)
    const title = tx.name || tx.description || cat.label || '—'
    const note = tx.name && tx.description && tx.description !== tx.name ? tx.description : ''
    const bg = i % 2 ? C.zebra : '#ffffff'
    return `
      <tr style="background:${bg};">
        <td style="${TD}text-align:center;color:${C.faint};font-size:10px;">${offset + i + 1}</td>
        <td style="${TD}white-space:nowrap;">
          <div style="color:${C.text};font-weight:500;">${day.main}</div>
          <div style="color:${C.faint};font-size:9px;margin-top:1px;">${day.day}</div>
        </td>
        <td style="${TD}">
          <div style="color:${C.ink};font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(title)}</div>
          ${note ? `<div style="color:${C.faint};font-size:9px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(note)}</div>` : ''}
        </td>
        <td style="${TD}">
          <div style="display:flex;align-items:center;gap:7px;">
            ${iconBubble(cat.icon, s.dark, s.soft, 22, 12)}
            <span style="color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(cat.label)}</span>
          </div>
        </td>
        <td style="${TD}text-align:center;">
          <span style="display:inline-block;height:20px;line-height:20px;padding:0 10px;border-radius:999px;
            background:${s.soft};color:${s.dark};font-size:9.5px;font-weight:600;white-space:nowrap;">${s.label}</span>
        </td>
        <td style="${TD}text-align:right;font-weight:700;font-size:12px;color:${s.amount};white-space:nowrap;">
          ${s.sign}${fmt(amountOf(tx))}
        </td>
      </tr>`
  }).join('')
}

function totalsFoot(stats, fmt) {
  const color = stats.balance >= 0 ? C.brand2 : TYPE_STYLE.expense.amount
  return `
    <tfoot>
      <tr style="background:${C.mint};">
        <td colspan="5" style="padding:0 12px;height:44px;font-size:11px;font-weight:600;color:${C.brand};">
          Net balance &nbsp;<span style="font-weight:400;color:${C.muted};">· ${stats.counts.all} transaction${stats.counts.all === 1 ? '' : 's'}</span>
        </td>
        <td style="padding:0 12px;height:44px;text-align:right;font-size:13px;font-weight:700;color:${color};white-space:nowrap;">
          ${fmt(stats.balance)}
        </td>
      </tr>
    </tfoot>`
}

// ── Pages ─────────────────────────────────────────────────────────────────────
function firstPage(ctx, chunk, isLast, totalPages) {
  const { opts, stats, breakdown, fmt } = ctx
  const inner = `
    ${header(opts)}
    ${summary(stats, fmt)}
    ${breakdown.length ? insights(stats, breakdown, fmt) : ''}
    <div style="padding:22px 36px 0;">
      ${sectionTitle('Transactions', `<span style="font-size:10px;color:${C.faint};">Sorted by date · oldest first</span>`)}
      ${table(rows(chunk, 0, opts.getCategoryInfo, fmt), isLast ? totalsFoot(stats, fmt) : '')}
    </div>`
  return pageFrame(inner, 1, totalPages)
}

function nextPage(ctx, chunk, offset, pageNum, isLast, totalPages) {
  const { opts, stats, fmt } = ctx
  const inner = `
    <div style="background:${C.brand};padding:14px 36px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${svg(Wallet, 15, '#ffffff', 2)}
        <span style="color:#ffffff;font-size:12px;font-weight:700;">FinanceFlow</span>
        <span style="color:#9ccdbe;font-size:12px;">·&nbsp; ${esc(opts.monthLabel || '')}</span>
      </div>
      <span style="color:#9ccdbe;font-size:10px;">Transactions (continued)</span>
    </div>
    <div style="padding:22px 36px 0;">
      ${table(rows(chunk, offset, opts.getCategoryInfo, fmt), isLast ? totalsFoot(stats, fmt) : '')}
    </div>`
  return pageFrame(inner, pageNum, totalPages)
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// Load a Khmer-capable font so Khmer names render nicely (best effort: the
// report still renders with system fonts when offline).
async function ensureFonts() {
  const id = 'ff-pdf-fonts'
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;500;600;700&display=swap'
    const loaded = new Promise((resolve) => { link.onload = resolve; link.onerror = resolve })
    document.head.appendChild(link)
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 2500))])
  }
  const loads = ['400', '500', '600', '700'].flatMap((w) => [
    document.fonts.load(`${w} 12px "Kantumruy Pro"`, 'ក'),
    document.fonts.load(`${w} 12px Inter`, 'A'),
  ])
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 2500))])
}

// html2canvas measures the text baseline with a hidden <span> + 1×1 <img>
// appended to <body>. Tailwind's preflight sets `img { display:block }`, which
// breaks that measurement and draws every line of text too low (labels fall
// out of their pills, the footer gets cut off). Restore inline images while
// capturing, scoped to html2canvas's probe element.
function fixHtml2canvasBaseline() {
  const style = document.createElement('style')
  style.textContent = 'body > div > span + img[width="1"][height="1"]{display:inline !important;}'
  document.head.appendChild(style)
  return () => style.remove()
}

async function capturePage(html) {
  const wrap = document.createElement('div')
  wrap.style.cssText = `position:absolute;top:0;left:-10000px;width:${PAGE_W}px;background:#ffffff;`
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  try {
    return await html2canvas(wrap.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: PAGE_W,
    })
  } finally {
    wrap.remove()
  }
}

function paginate(list, firstSize, restSize) {
  const chunks = [list.slice(0, firstSize)]
  for (let i = firstSize; i < list.length; i += restSize) chunks.push(list.slice(i, i + restSize))
  return chunks
}

// ── Main export entry-point ───────────────────────────────────────────────────
/**
 * opts: { transactions, monthLabel, formatCurrency, getCategoryInfo, userName }
 * (income / expense / balance are still accepted but recomputed from the rows
 *  with the shared finance rules, so the report always matches its own table.)
 */
export function usePdfExport() {
  const exportToPdf = async (opts) => {
    const sorted = [...(opts.transactions || [])].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)))

    const fmt = (n) => esc(opts.formatCurrency(Number(n) || 0))
    const t = totals(sorted)
    const expenses = sorted.filter((tx) => tx.type === 'expense')
    const stats = {
      ...t,
      counts: {
        all: sorted.length,
        income: sorted.filter((tx) => tx.type === 'income').length,
        expense: expenses.length,
      },
      largest: expenses.reduce((m, tx) => (!m || amountOf(tx) > amountOf(m) ? tx : m), null),
    }
    const breakdown = expenseBreakdown(sorted, opts.getCategoryInfo)
    const ctx = { opts, stats, breakdown, fmt }

    const chunks = paginate(sorted, breakdown.length ? ROWS_P1_WITH_BREAKDOWN : ROWS_P1, ROWS_REST)
    const totalPages = chunks.length

    await ensureFonts()
    const restore = fixHtml2canvasBaseline()
    const canvases = []
    try {
      let offset = 0
      // Sequential on purpose — parallel captures fight over the DOM.
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1
        const html = i === 0
          ? firstPage(ctx, chunks[0], isLast, totalPages)
          : nextPage(ctx, chunks[i], offset, i + 1, isLast, totalPages)
        canvases.push(await capturePage(html))
        offset += chunks[i].length
      }
    } finally {
      restore()
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW = 210
    const pageH = 297
    canvases.forEach((canvas, i) => {
      if (i > 0) doc.addPage()
      // Fit the whole page; if it is ever taller than A4, shrink it (centred)
      // rather than cutting rows off.
      const ratio = canvas.height / canvas.width
      let w = pageW
      let hgt = w * ratio
      if (hgt > pageH) { hgt = pageH; w = hgt / ratio }
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, 0, w, hgt)
    })

    const safeName = (opts.monthLabel || 'all')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '') || 'report'
    doc.save(`transactions-${safeName}.pdf`)
  }

  return { exportToPdf }
}
