/**
 * Server-to-server Google OAuth for the Firestore REST API.
 *
 * Signs a short-lived JWT with the service account's private key (RS256 via
 * WebCrypto — no SDK needed) and exchanges it for an access token that is
 * cached in memory until shortly before it expires.
 *
 * Scope is limited to Datastore/Firestore. Give the service account only the
 * "Cloud Datastore User" role (see README) — never Owner/Editor.
 */
import { base64url } from '../security/crypto.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'

let cache = null // { token, expiresAt, email }

function pemToPkcs8(pem) {
  // Secrets pasted via `wrangler secret put` often keep literal "\n" sequences
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const raw = atob(body)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

async function signJwt(email, privateKeyPem, nowSec) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  }))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  return `${header}.${claims}.${base64url(sig)}`
}

export async function getAccessToken(env) {
  const now = Date.now()
  if (cache && cache.email === env.FIREBASE_CLIENT_EMAIL && cache.expiresAt - 60_000 > now) return cache.token

  const assertion = await signJwt(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY, Math.floor(now / 1000))
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) {
    // Never log the assertion or key — only the status
    throw new Error(`google_token_failed_${res.status}`)
  }
  const data = await res.json()
  cache = { token: data.access_token, expiresAt: now + (data.expires_in || 3600) * 1000, email: env.FIREBASE_CLIENT_EMAIL }
  return cache.token
}

/** Test helper: forget the cached token. */
export const _resetTokenCache = () => { cache = null }
