/**
 * Telegram ⇄ app account linking.
 *
 * Firestore layout (see firestore.rules.snippet for the matching rules):
 *   telegramLinkCodes/{sha256(code)}   written by the signed-in Vue user:
 *                                      { uid, expiresAt (timestamp), createdAt, timezone }
 *   telegramLinks/{telegramUserId}     written ONLY by this Worker:
 *                                      { uid, sig = HMAC(LINK_SIGNING_KEY, "tg:uid"), linkedAt }
 *   users/{uid}/settings/telegram      written by this Worker, read (and deleted
 *                                      to disconnect) by the Vue app:
 *                                      { telegramUserId, username, firstName, linkedAt, timezone }
 *
 * A request is authorised only when ALL hold:
 *   1. telegramLinks/{fromId} exists,
 *   2. its HMAC signature verifies (cannot be forged from a browser even if
 *      Firestore rules were too permissive),
 *   3. users/{uid}/settings/telegram still names this Telegram user (so
 *      "Disconnect" in the app takes effect immediately).
 */
import { sha256Hex, hmacHex, safeEqual } from './crypto.js'
import { PreconditionError } from '../firebase/client.js'

export const LINK_CODE_RE = /^[A-Za-z0-9_-]{20,64}$/

const signLink = (env, tgId, uid) => hmacHex(env.LINK_SIGNING_KEY, `${tgId}:${uid}`)

// Per-isolate memory of HMAC-verified links (telegramId → uid). This only
// skips re-reading telegramLinks/{id}; the "still connected?" check
// (users/{uid}/settings/telegram) runs on EVERY message, so disconnecting in
// the app still takes effect immediately.
const LINK_CACHE_MS = 5 * 60 * 1000
const linkCache = new Map()
export const _clearLinkCache = () => linkCache.clear()
const remember = (id, uid) => {
  if (linkCache.size > 500) linkCache.clear()
  linkCache.set(id, { uid, at: Date.now() })
}

async function verifiedLinkUid(fs, env, id) {
  const link = await fs.get(`telegramLinks/${id}`)
  if (!link?.uid || !link.sig) return null
  if (!safeEqual(link.sig, await signLink(env, id, link.uid))) {
    console.warn(JSON.stringify({ event: 'link_signature_mismatch' }))
    return null
  }
  return link.uid
}

/**
 * Resolve the verified user for a Telegram sender, or null.
 * Returns { uid, settings, prefs, session } — loaded in ONE batch read
 * (plus one link read when the link isn't cached yet).
 */
export async function resolveUser(fs, env, tgId, { useCache = true } = {}) {
  const id = String(tgId)
  const cached = useCache ? linkCache.get(id) : null
  const fromCache = !!cached && Date.now() - cached.at < LINK_CACHE_MS
  const uid = fromCache ? cached.uid : await verifiedLinkUid(fs, env, id)
  if (!uid) return null

  const [settings, prefs, session] = await fs.batchGet([
    `users/${uid}/settings/telegram`,
    `users/${uid}/settings/preferences`,
    `telegramSessions/${id}`,
  ])

  if (!settings || String(settings.telegramUserId) !== id) {
    linkCache.delete(id)
    // The link may have changed elsewhere — re-check the source of truth once
    if (fromCache) return resolveUser(fs, env, tgId, { useCache: false })
    // Disconnected from the app → clean up the stale mapping
    await fs.commit([{ delete: `telegramLinks/${id}` }]).catch(() => {})
    return null
  }
  remember(id, uid)
  return { uid, settings, prefs: prefs || {}, session }
}

/**
 * Consume a one-time code and link accounts.
 * Returns { ok: true, uid } or { ok: false, reason } with reason in:
 *   invalid | expired | telegram_already_linked | account_already_linked | used
 */
export async function linkWithCode(fs, env, code, from, nowMs = Date.now()) {
  if (!LINK_CODE_RE.test(code || '')) return { ok: false, reason: 'invalid' }
  const hash = await sha256Hex(code)
  const codeDoc = await fs.get(`telegramLinkCodes/${hash}`)
  if (!codeDoc?.uid) return { ok: false, reason: 'invalid' }

  if (!codeDoc.expiresAt || Date.parse(codeDoc.expiresAt) <= nowMs) {
    await fs.commit([{ delete: `telegramLinkCodes/${hash}` }]).catch(() => {})
    return { ok: false, reason: 'expired' }
  }

  const tgId = String(from.id)
  const uid = codeDoc.uid

  // One Telegram account ⇄ one app account (unless explicitly unlinked first)
  const existing = await resolveUser(fs, env, tgId)
  if (existing && existing.uid !== uid) return { ok: false, reason: 'telegram_already_linked' }
  const current = await fs.get(`users/${uid}/settings/telegram`)
  if (current && String(current.telegramUserId) !== tgId) return { ok: false, reason: 'account_already_linked' }

  const linkedAt = new Date(nowMs)
  try {
    // Atomic + single-use: the code must still exist; it is deleted in the same commit.
    await fs.commit([
      { delete: `telegramLinkCodes/${hash}`, exists: true },
      { set: `telegramLinks/${tgId}`, data: { uid, sig: await signLink(env, tgId, uid), linkedAt } },
      {
        set: `users/${uid}/settings/telegram`,
        data: {
          telegramUserId: tgId,
          username: from.username || '',
          firstName: from.first_name || '',
          linkedAt,
          timezone: typeof codeDoc.timezone === 'string' ? codeDoc.timezone : '',
        },
      },
    ])
  } catch (e) {
    if (e instanceof PreconditionError) return { ok: false, reason: 'used' }
    throw e
  }
  remember(tgId, uid)
  return { ok: true, uid }
}

/** Unlink from the Telegram side (/unlink). */
export async function unlink(fs, tgId, uid) {
  linkCache.delete(String(tgId))
  await fs.commit([
    { delete: `telegramLinks/${tgId}` },
    { delete: `users/${uid}/settings/telegram` },
    { delete: `telegramSessions/${tgId}` },
  ])
}
