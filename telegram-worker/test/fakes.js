/**
 * In-memory stand-ins for Google OAuth, Firestore REST and the Telegram Bot API,
 * installed by replacing globalThis.fetch. They enforce the same contracts the
 * real services do (bearer tokens, JWT signatures, commit preconditions).
 */
import { encodeFields, decodeFields, decodeValue } from '../src/firebase/client.js'

const enc = new TextEncoder()
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

export async function makeServiceAccount() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  )
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const b64 = btoa(String.fromCharCode(...pkcs8))
  // Literal "\n" like a secret pasted into `wrangler secret put`
  const pem = `-----BEGIN PRIVATE KEY-----\\n${b64.match(/.{1,64}/g).join('\\n')}\\n-----END PRIVATE KEY-----\\n`
  return { pem, publicKey: pair.publicKey }
}

export function installFakes({ projectId, publicKey, clientEmail }) {
  const store = new Map() // 'users/u1/transactions/abc' → typed fields
  const telegram = []     // recorded Bot API calls
  const issuedTokens = new Set()
  const stats = { tokenRequests: 0, firestoreCalls: 0 }
  const prefix = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  const rootName = `projects/${projectId}/databases/(default)/documents`
  let messageId = 100

  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const err = (status, code) => json({ error: { status: code } }, status)
  const resource = (path) => ({ name: `${rootName}/${path}`, fields: store.get(path) })

  const cmp = (a, op, b) => ({
    EQUAL: a === b, GREATER_THAN_OR_EQUAL: a >= b, LESS_THAN_OR_EQUAL: a <= b,
    GREATER_THAN: a > b, LESS_THAN: a < b,
  })[op]

  async function google(req) {
    stats.tokenRequests++
    const form = new URLSearchParams(await req.text())
    const [h, c, s] = form.get('assertion').split('.')
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, b64urlToBytes(s), enc.encode(`${h}.${c}`))
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(c)))
    if (!ok || claims.iss !== clientEmail || !claims.scope.includes('datastore')) return json({ error: 'invalid_grant' }, 400)
    const token = `tok_${issuedTokens.size + 1}`
    issuedTokens.add(token)
    return json({ access_token: token, expires_in: 3600 })
  }

  async function firestore(req, url) {
    stats.firestoreCalls++
    const auth = req.headers.get('authorization') || ''
    if (!issuedTokens.has(auth.replace('Bearer ', ''))) return err(401, 'UNAUTHENTICATED')
    const rest = decodeURIComponent(url.pathname.slice(new URL(prefix).pathname.length))

    if (req.method === 'POST' && rest === ':commit') {
      const { writes } = await req.json()
      const strip = (name) => name.slice(rootName.length + 1)
      for (const w of writes) {
        const path = strip(w.delete || w.update.name)
        if (w.currentDocument?.exists === false && store.has(path)) return err(409, 'ALREADY_EXISTS')
        if (w.currentDocument?.exists === true && !store.has(path)) return err(404, 'NOT_FOUND')
      }
      for (const w of writes) {
        if (w.delete) store.delete(strip(w.delete))
        else if (w.updateMask) {
          // Like Firestore: masked fields are set from `fields`; masked fields
          // missing from `fields` are deleted.
          const path = strip(w.update.name)
          const next = { ...(store.get(path) || {}) }
          for (const f of w.updateMask.fieldPaths) {
            if (f in (w.update.fields || {})) next[f] = w.update.fields[f]
            else delete next[f]
          }
          store.set(path, next)
        } else store.set(strip(w.update.name), w.update.fields)
      }
      return json({ writeResults: [] })
    }

    if (req.method === 'POST' && rest === ':batchGet') {
      const { documents } = await req.json()
      return json(documents.map((name) => {
        const path = name.slice(rootName.length + 1)
        return store.has(path) ? { found: resource(path) } : { missing: name }
      }))
    }

    if (req.method === 'POST' && rest.endsWith(':runQuery')) {
      const parent = rest.slice(1, -':runQuery'.length)
      const { structuredQuery: q } = await req.json()
      const coll = `${parent}/${q.from[0].collectionId}`
      let docs = [...store.keys()]
        .filter((k) => k.startsWith(coll + '/') && k.split('/').length === coll.split('/').length + 1)
        .map((k) => ({ path: k, data: decodeFields(store.get(k)) }))
      const filters = q.where ? (q.where.compositeFilter ? q.where.compositeFilter.filters : [q.where]) : []
      for (const f of filters) {
        const { field, op, value } = f.fieldFilter
        docs = docs.filter((d) => cmp(d.data[field.fieldPath], op, decodeValue(value)))
      }
      if (q.orderBy) {
        const { field, direction } = q.orderBy[0]
        docs = docs.filter((d) => d.data[field.fieldPath] !== undefined)
          .sort((a, b) => (a.data[field.fieldPath] < b.data[field.fieldPath] ? -1 : 1) * (direction === 'DESCENDING' ? -1 : 1))
      }
      if (q.limit) docs = docs.slice(0, q.limit)
      return json(docs.length ? docs.map((d) => ({ document: resource(d.path) })) : [{ readTime: 'now' }])
    }

    if (req.method === 'GET') {
      const path = rest.slice(1)
      const segs = path.split('/').length
      if (segs % 2 === 0) return store.has(path) ? json(resource(path)) : err(404, 'NOT_FOUND')
      const docs = [...store.keys()].filter((k) => k.startsWith(path + '/') && k.split('/').length === segs + 1)
      return json({ documents: docs.map(resource) })
    }
    return err(400, 'INVALID_ARGUMENT')
  }

  async function telegramApi(req, url) {
    const method = url.pathname.split('/').pop()
    const body = await req.json()
    telegram.push({ method, body })
    return json({ ok: true, result: { message_id: ++messageId } })
  }

  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init)
    const url = new URL(req.url)
    if (url.host === 'oauth2.googleapis.com') return google(req)
    if (url.host === 'firestore.googleapis.com') return firestore(req, url)
    if (url.host === 'api.telegram.org') return telegramApi(req, url)
    throw new Error(`unexpected fetch to ${url.host}`)
  }

  return {
    store,
    telegram,
    stats,
    seed: (path, obj) => store.set(path, encodeFields(obj)),
    read: (path) => (store.has(path) ? decodeFields(store.get(path)) : null),
    docsUnder: (coll) => [...store.keys()].filter((k) => k.startsWith(coll + '/') && k.split('/').length === coll.split('/').length + 1),
    lastText: () => {
      const m = [...telegram].reverse().find((c) => c.method === 'sendMessage' || c.method === 'editMessageText')
      return m?.body.text || ''
    },
    lastMarkup: () => {
      const m = [...telegram].reverse().find((c) => c.body.reply_markup)
      return m?.body.reply_markup?.inline_keyboard || []
    },
  }
}
