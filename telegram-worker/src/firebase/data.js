/**
 * Data access for ONE verified user. Every function takes `uid` that came from
 * security/linking.js#resolveUser — never from message text or callback data.
 * Paths mirror the Vue app exactly (users/{uid}/transactions, …).
 */
import { normalizeBudgets } from '../../../src/shared/finance.js'

export function createData(fs) {
  const tx = (uid) => `users/${uid}/transactions`

  return {
    // ── Transactions ──────────────────────────────────────────────────────────
    // One streamed query (no paging) with only the fields totals need
    allTransactions: (uid) =>
      fs.query(`users/${uid}`, 'transactions', { select: ['type', 'amount', 'date'] }),

    /** Transactions with date in [start, end] (inclusive 'YYYY-MM-DD'). */
    transactionsBetween: (uid, start, end) =>
      fs.query(`users/${uid}`, 'transactions', {
        filters: [['date', 'GREATER_THAN_OR_EQUAL', start], ['date', 'LESS_THAN_OR_EQUAL', end]],
      }),

    /** Latest N by date (same ordering the app's "recent" list uses). */
    recentTransactions: (uid, n = 10) =>
      fs.query(`users/${uid}`, 'transactions', { orderBy: 'date', direction: 'DESCENDING', limit: n }),

    getTransaction: (uid, id) => fs.get(`${tx(uid)}/${id}`),

    /** Recent history used to guess categories (only the fields needed). */
    historyForGuess: (uid, n = 80) =>
      fs.query(`users/${uid}`, 'transactions', {
        orderBy: 'date', direction: 'DESCENDING', limit: n, select: ['type', 'category', 'description', 'date'],
      }),

    /**
     * Instant save. The id is derived from the Telegram message/button, so a
     * re-delivered update hits the create-only precondition instead of saving twice.
     */
    createTransaction: (uid, id, record) => fs.commit([{ set: `${tx(uid)}/${id}`, data: record, exists: false }]),

    /** Change fields of an existing transaction in THIS user's collection only. */
    patchTransaction: (uid, id, fields) => fs.commit([{ patch: `${tx(uid)}/${id}`, data: fields, exists: true }]),

    patchTelegramSettings: (uid, fields) =>
      fs.commit([{ patch: `users/${uid}/settings/telegram`, data: fields, exists: true }]),

    /** Delete only if it exists in THIS user's collection. */
    deleteTransaction: (uid, id) => fs.commit([{ delete: `${tx(uid)}/${id}`, exists: true }]),

    // ── Categories / budgets / preferences ───────────────────────────────────
    categories: async (uid, type) => {
      const all = await fs.list(`users/${uid}/categories`)
      return type ? all.filter((c) => c.type === type) : all
    },
    budgets: async (uid) => {
      const doc = await fs.get(`users/${uid}/settings/budgets`)
      if (!doc) return {}
      const { id: _id, ...data } = doc
      return normalizeBudgets(data)
    },
    preferences: async (uid) => (await fs.get(`users/${uid}/settings/preferences`)) || {},

    // ── Conversation sessions (one per Telegram user) ────────────────────────
    getSession: (tgId) => fs.get(`telegramSessions/${tgId}`),
    setSession: (tgId, data) => fs.commit([{ set: `telegramSessions/${tgId}`, data }]),
    clearSession: (tgId) => fs.commit([{ delete: `telegramSessions/${tgId}` }]),

    /**
     * Save a confirmed transaction exactly once.
     * Atomic: the pending session must still exist (single use) AND the
     * transaction id `tg_<nonce>` must not exist yet. A duplicate webhook
     * delivery or double-tap fails the precondition and writes nothing.
     */
    saveConfirmedTransaction: (tgId, uid, nonce, record) =>
      fs.commit([
        { delete: `telegramSessions/${tgId}`, exists: true },
        { set: `${tx(uid)}/tg_${nonce}`, data: record, exists: false },
      ]),
  }
}
