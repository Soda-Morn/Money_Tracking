/**
 * Minimal Firestore REST client (no SDK — keeps the Worker tiny).
 *
 * The Worker authenticates as a service account, which BYPASSES Firestore
 * security rules. Therefore every caller must build document paths from the
 * server-verified user (see security/linking.js#resolveUser) — never from
 * anything inside a Telegram message.
 */
import { getAccessToken } from './auth.js'

export class PreconditionError extends Error {
  constructor(status) { super(`precondition_${status}`); this.name = 'PreconditionError' }
}

// ── Value encoding (JS ⇄ Firestore typed values) ──────────────────────────────
export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    // Match the Firebase JS SDK: whole numbers are integers, others doubles
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } }
  return { mapValue: { fields: encodeFields(v) } }
}
export const encodeFields = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeValue(v)]))

export function decodeValue(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {})
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue)
  if ('referenceValue' in v) return v.referenceValue
  return null
}
export const decodeFields = (fields = {}) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]))

const docFromResource = (d) => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields) })

// ── Client ────────────────────────────────────────────────────────────────────
export function createFirestore(env) {
  const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
  const base = `https://firestore.googleapis.com/v1/${root}`
  const encPath = (path) => path.split('/').map(encodeURIComponent).join('/')

  async function request(url, init = {}) {
    const token = await getAccessToken(env)
    return fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
    })
  }

  async function fail(res, op) {
    let status = ''
    try { status = (await res.json())?.error?.status || '' } catch { /* ignore */ }
    if (['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(status) && op === 'commit') {
      throw new PreconditionError(status)
    }
    throw new Error(`firestore_${op}_${res.status}_${status}`)
  }

  return {
    /** Get one document, or null if it doesn't exist. */
    async get(path) {
      const res = await request(`${base}/${encPath(path)}`)
      if (res.status === 404) return null
      if (!res.ok) await fail(res, 'get')
      return docFromResource(await res.json())
    },

    /**
     * Several documents in ONE request (order matches `paths`, null = missing).
     * Used to load everything a message needs in a single round trip.
     */
    async batchGet(paths) {
      const res = await request(`${base}:batchGet`, {
        method: 'POST',
        body: JSON.stringify({ documents: paths.map((p) => `${root}/${p}`) }),
      })
      if (!res.ok) await fail(res, 'batchGet')
      const rows = await res.json()
      const found = new Map()
      for (const r of rows) if (r.found) found.set(r.found.name, docFromResource(r.found))
      return paths.map((p) => found.get(`${root}/${p}`) ?? null)
    },

    /** All documents in a collection (follows pagination). */
    async list(collectionPath) {
      const out = []
      let pageToken = ''
      do {
        const qs = new URLSearchParams({ pageSize: '300' })
        if (pageToken) qs.set('pageToken', pageToken)
        const res = await request(`${base}/${encPath(collectionPath)}?${qs}`)
        if (!res.ok) await fail(res, 'list')
        const data = await res.json()
        ;(data.documents || []).forEach((d) => out.push(docFromResource(d)))
        pageToken = data.nextPageToken || ''
      } while (pageToken)
      return out
    },

    /**
     * Structured query on one subcollection. Only single-field filters/orders
     * are used so no composite index is ever required.
     *   filters: [[field, op, value]]  op ∈ EQUAL, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL
     */
    async query(parentPath, collectionId, { filters = [], orderBy, direction = 'DESCENDING', limit, select } = {}) {
      const structuredQuery = { from: [{ collectionId }] }
      // Field mask: only download the fields we use (smaller, faster responses)
      if (select) structuredQuery.select = { fields: select.map((f) => ({ fieldPath: f })) }
      if (filters.length) {
        const fieldFilters = filters.map(([field, op, value]) => ({
          fieldFilter: { field: { fieldPath: field }, op, value: encodeValue(value) },
        }))
        structuredQuery.where = fieldFilters.length === 1
          ? fieldFilters[0]
          : { compositeFilter: { op: 'AND', filters: fieldFilters } }
      }
      if (orderBy) structuredQuery.orderBy = [{ field: { fieldPath: orderBy }, direction }]
      if (limit) structuredQuery.limit = limit
      const res = await request(`${base}/${encPath(parentPath)}:runQuery`, {
        method: 'POST',
        body: JSON.stringify({ structuredQuery }),
      })
      if (!res.ok) await fail(res, 'query')
      const rows = await res.json()
      return rows.filter((r) => r.document).map((r) => docFromResource(r.document))
    },

    /**
     * Atomic multi-document write. Each write:
     *   { set: path, data, exists? }   — full overwrite; exists:false = create-only
     *   { patch: path, data, exists? } — change only the given fields
     *   { delete: path, exists? }      — exists:true = must exist (single-use)
     * Throws PreconditionError if any precondition fails (nothing is written).
     */
    async commit(writes) {
      const body = {
        writes: writes.map((w) => {
          const out = w.delete
            ? { delete: `${root}/${w.delete}` }
            : { update: { name: `${root}/${w.set || w.patch}`, fields: encodeFields(w.data) } }
          if (w.patch) out.updateMask = { fieldPaths: Object.keys(w.data) }
          if (typeof w.exists === 'boolean') out.currentDocument = { exists: w.exists }
          return out
        }),
      }
      const res = await request(`${base}:commit`, { method: 'POST', body: JSON.stringify(body) })
      if (!res.ok) await fail(res, 'commit')
      return true
    },
  }
}
