/**
 * Pick a category for an instant save, so the user can type just "5" or
 * "5 coffee" and be done. Only the user's own categories of the right type
 * are ever chosen (same rule as the app's add form).
 *
 * Order:
 *   1. "named"   — the text starts with a category ("12 food lunch")
 *   2. "learned" — the same note was used before ("coffee" → last time: Drinks)
 *   3. "usual"   — the most-used category of that type recently
 *   4. "first"   — the first category in the list
 */
import { splitCategory } from '../security/validation.js'

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

export function guessCategory({ type, words, categories, history }) {
  const byValue = new Map(categories.map((c) => [c.value, c]))
  const past = history.filter((t) => t.type === type && byValue.has(t.category))

  // Usage counts (recent history) → ranking for "usual" and the quick-switch buttons
  const counts = new Map()
  past.forEach((t) => counts.set(t.category, (counts.get(t.category) || 0) + 1))
  const ranked = [...categories].sort((a, b) => (counts.get(b.value) || 0) - (counts.get(a.value) || 0))

  let category = null
  let note = String(words || '').trim()
  let how = 'first'

  const hit = splitCategory(note, categories)
  if (hit) {
    category = hit.category
    note = hit.rest
    how = 'named'
  } else if (note) {
    const n = norm(note)
    const first = n.split(' ')[0]
    const same = past.find((t) => norm(t.description) === n)
      || past.find((t) => norm(t.description).split(' ')[0] === first)
    if (same) { category = byValue.get(same.category); how = 'learned' }
  }
  if (!category && counts.size) { category = ranked[0]; how = 'usual' }
  if (!category) category = categories[0]

  const alternatives = ranked.filter((c) => c.value !== category.value).slice(0, 3)
  return { category, note, how, alternatives }
}
