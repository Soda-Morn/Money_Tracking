import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── Type colours ──────────────────────────────────────────────────────────────
const TYPE_STYLE = {
  income:  { row: '#f0fdf4', amount: '#15803d', badge: '#dcfce7', badgeText: '#166534' },
  expense: { row: '#fff5f5', amount: '#b91c1c', badge: '#fee2e2', badgeText: '#991b1b' },
  borrow:  { row: '#eff6ff', amount: '#1d4ed8', badge: '#dbeafe', badgeText: '#1e40af' },
  payback: { row: '#f5f3ff', amount: '#6d28d9', badge: '#ede9fe', badgeText: '#5b21b6' },
}

// ── Table pieces ──────────────────────────────────────────────────────────────
const TH_STYLE = `
  padding: 11px 12px;
  text-align: left;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  background: #1e3a8a;
`

function tableHeader() {
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>
        <col style="width:30px">
        <col style="width:90px">
        <col>
        <col style="width:130px">
        <col style="width:82px">
        <col style="width:98px">
      </colgroup>
      <thead>
        <tr>
          <th style="${TH_STYLE}text-align:center;">#</th>
          <th style="${TH_STYLE}">Date</th>
          <th style="${TH_STYLE}">Name / Description</th>
          <th style="${TH_STYLE}">Category</th>
          <th style="${TH_STYLE}text-align:center;">Type</th>
          <th style="${TH_STYLE}text-align:right;">Amount</th>
        </tr>
      </thead>`
}

function buildRows(rows, getCategoryInfo, formatCurrency, offset = 0) {
  return rows.map((tx, i) => {
    const s     = TYPE_STYLE[tx.type] || TYPE_STYLE.expense
    const cat   = getCategoryInfo(tx.category, tx.type)
    const label = tx.name || tx.description || cat.label || '—'
    const sign  = (tx.type === 'income' || tx.type === 'borrow') ? '+' : '−'
    const type  = tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
    const TD    = `padding:9px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;vertical-align:middle;`
    return `
      <tr style="background:${s.row};">
        <td style="${TD}text-align:center;color:#b0b7c3;font-size:10px;">${offset + i + 1}</td>
        <td style="${TD}color:#374151;white-space:nowrap;">${tx.date}</td>
        <td style="${TD}color:#111827;overflow:hidden;">${label}</td>
        <td style="${TD}color:#6b7280;">${cat.icon || ''}&nbsp;${cat.label || '—'}</td>
        <td style="${TD}text-align:center;">
          <span style="
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.4;
            background: ${s.badge};
            color: ${s.badgeText};
            white-space: nowrap;
          ">${type}</span>
        </td>
        <td style="${TD}text-align:right;font-weight:800;font-size:12px;color:${s.amount};white-space:nowrap;">${sign}${formatCurrency(Number(tx.amount))}</td>
      </tr>`
  }).join('')
}

// ── Footer strip ──────────────────────────────────────────────────────────────
function footer(pageNum, totalPages) {
  return `
    <div style="
      margin: 18px 28px 20px;
      padding-top: 12px;
      border-top: 1.5px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <span style="font-size:9.5px;color:#9ca3af;">
        Money Tracking &nbsp;·&nbsp; Made by
        <strong style="color:#2563eb;">Soda MORN</strong>
      </span>
      <span style="font-size:9.5px;color:#9ca3af;font-weight:600;">
        Page ${pageNum} / ${totalPages}
      </span>
    </div>`
}

// ── Page 1  (header + summary + table) ───────────────────────────────────────
function buildPage1(opts, chunk, pageNum, totalPages) {
  const { monthLabel, income, expense, balance, formatCurrency, getCategoryInfo, userName, totalCount } = opts
  const now      = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const balColor = balance >= 0 ? '#15803d' : '#b91c1c'

  return `
    <div style="width:794px;background:#ffffff;font-family:'Inter','Segoe UI',Arial,sans-serif;box-sizing:border-box;">

      <!-- ── HEADER ── -->
      <div style="
        background: linear-gradient(120deg, #1e40af 0%, #2563eb 55%, #4f46e5 100%);
        padding: 22px 28px 20px;
        overflow: hidden;
        position: relative;
      ">
        <!-- decorative circles -->
        <div style="position:absolute;top:-30px;right:-15px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
        <div style="position:absolute;bottom:-25px;right:80px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
              <div style="
                width:32px;height:32px;
                background:rgba(255,255,255,0.18);
                border-radius:9px;
                display:flex;align-items:center;justify-content:center;
                font-size:16px;line-height:1;
              ">💵</div>
              <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Money Tracking</span>
            </div>
            <p style="color:#bfdbfe;font-size:11.5px;margin:0;line-height:1.4;">
              Transaction Report &nbsp;—&nbsp;
              <strong style="color:#ffffff;">${monthLabel}</strong>
            </p>
          </div>
          <div style="text-align:right;padding-top:2px;">
            <p style="color:#bfdbfe;font-size:9.5px;margin:0 0 4px 0;">Generated: ${now}</p>
            ${userName ? `<p style="color:#93c5fd;font-size:9.5px;margin:0;font-weight:600;">By: ${userName}</p>` : ''}
          </div>
        </div>
      </div>

      <!-- ── SUMMARY CARDS ── -->
      <div style="display:flex;gap:14px;padding:20px 28px 0;">
        <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:14px 16px;">
          <p style="color:#16803c;font-size:9px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:.6px;">Total Income</p>
          <p style="color:#15803d;font-size:18px;font-weight:800;margin:0;line-height:1.2;">${formatCurrency(income)}</p>
        </div>
        <div style="flex:1;background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;padding:14px 16px;">
          <p style="color:#b91c1c;font-size:9px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:.6px;">Total Expense</p>
          <p style="color:#b91c1c;font-size:18px;font-weight:800;margin:0;line-height:1.2;">${formatCurrency(expense)}</p>
        </div>
        <div style="flex:1;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:14px 16px;">
          <p style="color:#1d4ed8;font-size:9px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:.6px;">Net Balance</p>
          <p style="color:${balColor};font-size:18px;font-weight:800;margin:0;line-height:1.2;">${formatCurrency(balance)}</p>
        </div>
      </div>

      <!-- ── TABLE SECTION LABEL ── -->
      <div style="padding:16px 28px 10px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;font-weight:700;color:#1f2937;">Transactions</span>
        <span style="
          background:#e5e7eb;color:#6b7280;
          font-size:10px;font-weight:600;
          padding:2px 9px;border-radius:99px;
        ">${totalCount}</span>
      </div>

      <!-- ── TABLE ──
           NOTE: border-radius on <table> doesn't work with border-collapse:collapse.
           Use a wrapper div with overflow:hidden instead. -->
      <div style="padding:0 28px;">
        <div style="border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;">
          ${tableHeader()}
          <tbody>${buildRows(chunk, getCategoryInfo, formatCurrency, 0)}</tbody>
          </table>
        </div>
      </div>

      ${footer(pageNum, totalPages)}
    </div>`
}

// ── Page 2+  (slim header + table) ───────────────────────────────────────────
function buildPageN(opts, chunk, offset, pageNum, totalPages) {
  const { monthLabel, formatCurrency, getCategoryInfo } = opts
  return `
    <div style="width:794px;background:#ffffff;font-family:'Inter','Segoe UI',Arial,sans-serif;box-sizing:border-box;">

      <!-- slim header -->
      <div style="
        background: #1e3a8a;
        padding: 13px 28px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span style="color:#fff;font-size:12px;font-weight:700;">
          Money Tracking &nbsp;·&nbsp; ${monthLabel}
        </span>
        <span style="color:#93c5fd;font-size:10px;font-weight:500;">Continued</span>
      </div>

      <!-- table -->
      <div style="padding:18px 28px 0;">
        <div style="border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;">
          ${tableHeader()}
          <tbody>${buildRows(chunk, getCategoryInfo, formatCurrency, offset)}</tbody>
          </table>
        </div>
      </div>

      ${footer(pageNum, totalPages)}
    </div>`
}

// ── Capture one HTML page → canvas (sequential, no DOM conflicts) ─────────────
async function capturePage(html) {
  const wrap = document.createElement('div')
  // position:absolute + large negative offset keeps it off-screen but fully rendered
  // Do NOT use z-index:-1 — it prevents html2canvas from seeing the element
  wrap.style.cssText = [
    'position:absolute',
    'top:0',
    'left:-9999px',
    'width:794px',
    'background:#ffffff',
    'overflow:visible',
  ].join(';')
  wrap.innerHTML = html
  document.body.appendChild(wrap)

  try {
    return await html2canvas(wrap.firstElementChild, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
      removeContainer: false,   // we handle removal ourselves
    })
  } finally {
    document.body.removeChild(wrap)
  }
}

// ── Main export entry-point ───────────────────────────────────────────────────
export function usePdfExport() {
  const exportToPdf = async (opts) => {
    const sorted = [...opts.transactions].sort((a, b) => (a.date > b.date ? 1 : -1))

    // Conservative row limits so content never overflows A4 height
    const ROWS_P1   = 16   // page 1 has header + summary, so fewer rows fit
    const ROWS_REST = 22   // continuation pages have more vertical room

    // Build chunks
    const chunks = []
    if (sorted.length <= ROWS_P1) {
      chunks.push(sorted)
    } else {
      chunks.push(sorted.slice(0, ROWS_P1))
      let i = ROWS_P1
      while (i < sorted.length) {
        chunks.push(sorted.slice(i, i + ROWS_REST))
        i += ROWS_REST
      }
    }

    const totalPages = chunks.length
    const augOpts    = { ...opts, totalCount: sorted.length }

    // Calculate row offset for each chunk
    const offsets = chunks.map((_, idx) => {
      if (idx === 0) return 0
      return ROWS_P1 + (idx - 1) * ROWS_REST
    })

    // Build HTML for every page
    const htmlPages = chunks.map((chunk, idx) =>
      idx === 0
        ? buildPage1(augOpts, chunk, 1, totalPages)
        : buildPageN(augOpts, chunk, offsets[idx], idx + 1, totalPages)
    )

    // Capture pages SEQUENTIALLY — parallel DOM operations cause conflicts
    const canvases = []
    for (const html of htmlPages) {
      canvases.push(await capturePage(html))
    }

    // Assemble PDF — each canvas becomes exactly one A4 page
    const doc   = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW = 210   // A4 width in mm
    const pageH = 297   // A4 height in mm

    canvases.forEach((canvas, idx) => {
      if (idx > 0) doc.addPage()
      // Fit width to 210mm; calculate proportional height
      const imgH = (canvas.height / canvas.width) * pageW
      // If content is shorter than A4, place it at top (white space below is fine)
      // If somehow taller (shouldn't happen with our row limits), clamp to page height
      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0, 0,
        pageW,
        Math.min(imgH, pageH)
      )
    })

    const safeName = (opts.monthLabel || 'all')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
    doc.save(`transactions-${safeName}.pdf`)
  }

  return { exportToPdf }
}
