/**
 * Smart Money Tracking — Telegram webhook (Cloudflare Worker, free plan).
 *
 *   Telegram ──POST /telegram/webhook──▶ this Worker ──REST──▶ Firestore
 *
 * Only Telegram knows TELEGRAM_WEBHOOK_SECRET (set via setWebhook), so any
 * request without the matching header is rejected before parsing.
 */
import { createFirestore } from './firebase/client.js'
import { createData } from './firebase/data.js'
import { createTelegram } from './telegram/api.js'
import { handleUpdate } from './telegram/commands.js'
import { safeEqual } from './security/crypto.js'
import { ERRORS } from './telegram/messages.js'

const MAX_BODY_BYTES = 256 * 1024
const REQUIRED = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'LINK_SIGNING_KEY',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
]

// Secrets piped in from a shell can carry a trailing newline — strip it so
// e.g. the webhook secret still matches Telegram's header exactly.
const cleanEnv = (env) => Object.fromEntries(
  Object.entries(env).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
)

export default {
  async fetch(request, rawEnv, execCtx) {
    const env = cleanEnv(rawEnv)
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/') return new Response('ok')
    if (url.pathname !== '/telegram/webhook') return new Response('Not found', { status: 404 })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const missing = REQUIRED.filter((k) => !env[k])
    if (missing.length) {
      console.error(JSON.stringify({ event: 'config_missing', keys: missing }))
      return new Response('Server not configured', { status: 500 })
    }

    if (!safeEqual(request.headers.get('x-telegram-bot-api-secret-token') || '', env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    let update
    try {
      update = await request.json()
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    const started = Date.now()
    const fs = createFirestore(env)
    const deps = {
      env,
      fs,
      data: createData(fs),
      tg: createTelegram(env, { defer: true }),
      // Work that shouldn't delay the reply (button spinner, command menu)
      background: (p) => (execCtx?.waitUntil ? execCtx.waitUntil(p) : p),
    }

    try {
      await handleUpdate(update, deps)
    } catch (e) {
      // Log the error class only — never tokens, keys or financial details
      console.error(JSON.stringify({ event: 'update_failed', update_id: update?.update_id, error: e?.message?.slice(0, 120) }))
      const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id
      if (chatId) await deps.tg.send(chatId, ERRORS.generic)
    }

    console.log(JSON.stringify({ event: 'update_done', kind: update?.callback_query ? 'button' : 'message', ms: Date.now() - started }))

    // Always 200 once authenticated: Telegram would otherwise re-deliver the
    // update. Saves are idempotent anyway (see firebase/data.js).
    // The final reply rides back in this response — one less round trip.
    const reply = deps.tg.takePending()
    if (reply) {
      return new Response(JSON.stringify({ method: reply.method, ...reply.payload }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('ok')
  },
}
