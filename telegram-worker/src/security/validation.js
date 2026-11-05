/**
 * Validation for user input from Telegram. Mirrors the Vue forms:
 *  - amount > 0, entered in USD (the storage currency), max 2 decimals
 *  - category must be one of the user's own categories of that type
 *    (the app's add form only offers user-created categories)
 *  - description optional, max 120 chars (same as the app's input maxlength)
 */

export const MAX_AMOUNT = 1_000_000_000
export const MAX_DESCRIPTION = 120

/** Parse a money amount. Returns { ok, value } or { ok:false, error }. */
export function parseAmount(raw) {
  const s = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'invalid_amount' }
  if (/\.\d{3,}$/.test(s)) return { ok: false, error: 'too_many_decimals' }
  const value = Number(s)
  if (!(value > 0)) return { ok: false, error: 'invalid_amount' }
  if (value > MAX_AMOUNT) return { ok: false, error: 'amount_too_large' }
  return { ok: true, value }
}

/** Trim, drop control characters, enforce length. */
export function cleanDescription(raw) {
  // eslint-disable-next-line no-control-regex
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (s.length > MAX_DESCRIPTION) return { ok: false, error: 'description_too_long' }
  return { ok: true, value: s }
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Slug used for /budget_<slug> commands (latin letters/digits only). */
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** Find a category by label (case-insensitive) or by its stored value key. */
export function findCategory(categories, text) {
  const t = norm(text)
  if (!t) return null
  return categories.find((c) => norm(c.label) === t)
    || categories.find((c) => norm(c.value) === t)
    || null
}

/**
 * Split leading words into { category, rest } using the longest category
 * label that matches the start of the text ("food & dining lunch" → Food &
 * Dining + "lunch"). Returns null if no category matches.
 */
export function splitCategory(text, categories) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  for (let n = Math.min(words.length, 6); n >= 1; n--) {
    const cat = findCategory(categories, words.slice(0, n).join(' '))
    if (cat) return { category: cat, rest: words.slice(n).join(' ') }
  }
  return null
}

/** "5", "+100 salary", "-12.5 taxi home" → { type, amount, rest } or null (not an amount). */
export function parseQuickEntry(text) {
  const m = String(text || '').trim().match(/^([+-])?\s*\$?(\d[\d,]*(?:\.\d+)?)(?:\s+([\s\S]+))?$/)
  if (!m) return null
  const amount = parseAmount(m[2])
  return { type: m[1] === '+' ? 'income' : 'expense', amount, rest: (m[3] || '').trim() }
}

/**
 * Parse "AMOUNT CATEGORY [DESCRIPTION]".
 * Category labels can contain spaces ("Food & Dining"), so the longest
 * matching prefix of the remaining words is used as the category.
 */
export function parseAddArgs(args, categories) {
  const words = String(args || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { ok: false, error: 'missing_args' }
  const amount = parseAmount(words[0])
  if (!amount.ok) return amount
  const rest = words.slice(1)
  if (rest.length === 0) return { ok: false, error: 'missing_category', amount: amount.value }

  for (let n = Math.min(rest.length, 6); n >= 1; n--) {
    const cat = findCategory(categories, rest.slice(0, n).join(' '))
    if (cat) {
      const desc = cleanDescription(rest.slice(n).join(' '))
      if (!desc.ok) return desc
      return { ok: true, amount: amount.value, category: cat, description: desc.value }
    }
  }
  return { ok: false, error: 'unknown_category', amount: amount.value, attempted: rest[0] }
}
