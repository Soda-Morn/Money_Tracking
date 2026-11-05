/**
 * Thin Telegram Bot API client.
 *
 * Speed trick (defer mode): Telegram lets a webhook answer with ONE Bot API
 * call in its HTTP response. We hold back the latest send/edit and return it
 * from the Worker (see index.js), saving a full round trip to Telegram on
 * every update. Earlier sends in the same update are flushed in order.
 *
 * Failures are logged (without the token) and swallowed so a Telegram hiccup
 * never turns into a webhook retry storm.
 */
export function createTelegram(env, { defer = false } = {}) {
  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`
  let pending = null

  async function call(method, payload) {
    try {
      const res = await fetch(`${base}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      // "message is not modified" is harmless (user tapped the same button twice)
      if (!data.ok && !/not modified/i.test(data.description || '')) {
        console.warn(JSON.stringify({ event: 'telegram_api_error', method, code: data.error_code }))
      }
      return data.result
    } catch (e) {
      console.warn(JSON.stringify({ event: 'telegram_api_unreachable', method, error: e.name }))
      return null
    }
  }

  async function queue(method, payload) {
    if (!defer) return call(method, payload)
    if (pending) await call(pending.method, pending.payload) // keep message order
    pending = { method, payload }
    return null
  }

  const opts = (keyboard) => ({
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  })

  return {
    send: (chatId, text, keyboard) => queue('sendMessage', { chat_id: chatId, text, ...opts(keyboard) }),
    edit: (chatId, messageId, text, keyboard) =>
      queue('editMessageText', { chat_id: chatId, message_id: messageId, text, ...opts(keyboard) }),
    answer: (callbackId, text) => call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) }),
    setCommands: (commands) => call('setMyCommands', { commands }),
    /** Remove the registered command list (typed commands keep working). */
    deleteCommands: () => call('deleteMyCommands', {}),
    /** 'default' + no command list → Telegram shows no blue "Menu" pill. */
    setMenuButton: (type = 'default') => call('setChatMenuButton', { menu_button: { type } }),
    /** The held-back final call, to be returned as the webhook response. */
    takePending: () => { const p = pending; pending = null; return p },
  }
}
