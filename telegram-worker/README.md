# Smart Money Tracking — Telegram bot

A Telegram interface to the **same Firebase data** as the Vue app.

```
Telegram ──webhook (secret header)──▶ Cloudflare Worker ──Firestore REST (service account)──▶ Firestore
Vue app ────────────────────────────────────────────────────────────────────────────────────▶ (same data)
```

- No second database, no Firebase Cloud Functions, no Blaze plan.
- Transactions created in Telegram use the app's exact schema (`users/{uid}/transactions`) and appear in the app instantly; app transactions show up in bot reports.
- Calculations are shared with the app (`../src/shared/finance.js`), so both always agree.

## What's free

| Service | Cost | Billing account needed? |
|---|---|---|
| Telegram Bot API / BotFather | Free | No |
| Cloudflare Workers **Free** plan (100,000 requests/day, 10 ms CPU per request) | Free | No |
| Google Cloud service account (in your Firebase project) | Free | No |
| Firestore on the **Spark** plan (50k reads / 20k writes per day) | Free | No |

Nothing in this setup requires a credit card. Typical use is a few hundred requests a day.
Note: `/balance` reads all your transactions (like the app does when it opens), so a user
with 1,000 transactions uses ~1,000 Firestore reads per `/balance`.

---

## Setup

You need Node.js 18+ and a terminal in this folder (`telegram-worker/`). Run `npm install` once.

### 1. Create the bot (BotFather) — free
1. In Telegram, open **@BotFather** → send `/newbot`.
2. Choose a name (e.g. *Smart Money Tracking*) and a username ending in `bot` (e.g. `smart_money_soda_bot`).

### 2. Get the bot token
BotFather replies with a token like `123456789:AA…`. **Treat it like a password.** Don't paste it into chats, the Vue app, or Git.

Optional — command suggestions: send `/setcommands` to BotFather, pick your bot, and paste:
```
menu - Main menu
balance - Balance, income and expenses
add - Add a transaction step by step
addexpense - Add an expense: 5 Food Lunch
addincome - Add income: 100 Salary Pay
expense - This month's expenses
income - This month's income
recent - Last 10 transactions
delete - Delete a transaction
report - This month's report
report_month - Report for a chosen month
report_year - This year's report
budget - Budgets this month
budget_remaining - Remaining budget
help - All commands
unlink - Disconnect this Telegram account
```

### 3. Create a Cloudflare account — free
Sign up at https://dash.cloudflare.com/sign-up (Free plan). Under **Workers & Pages**, choose a free `*.workers.dev` subdomain when asked.

### 4. Install and log in to Wrangler
```bash
npm install            # installs wrangler locally (dev dependency)
npx wrangler login     # opens the browser to authorise
```

### 5. Create the Worker
The Worker is defined in `wrangler.toml` (name `smart-money-telegram`). It is created on first deploy (step 8). Optionally change `DEFAULT_TIMEZONE` there.

### 6. Configure Worker secrets
Generate two long random values (run twice, use different outputs):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Then set each secret (Wrangler prompts for the value — it is never stored in files):
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN        # from step 2
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # random value #1
npx wrangler secret put LINK_SIGNING_KEY          # random value #2 — keep it forever; changing it unlinks everyone
npx wrangler secret put FIREBASE_PROJECT_ID       # from step 7
npx wrangler secret put FIREBASE_CLIENT_EMAIL     # from step 7
npx wrangler secret put FIREBASE_PRIVATE_KEY      # from step 7 (paste the whole -----BEGIN PRIVATE KEY----- … value)
```

### 7. Firebase service account (least privilege) — free
Use a **dedicated** account with only Firestore access, *not* the default `firebase-adminsdk` key (which has far broader permissions).

1. Open https://console.cloud.google.com → select your Firebase project.
2. **IAM & Admin → Service Accounts → Create service account**, name it `telegram-bot`.
3. Grant exactly one role: **Cloud Datastore User** (`roles/datastore.user`). Skip "grant users access".
4. Open the account → **Keys → Add key → Create new key → JSON**. A file downloads.
5. From that file, copy `project_id`, `client_email` and `private_key` into the three secrets above.
6. **Delete the downloaded JSON file.** Never commit it (it is git-ignored here as a safety net).

#### Firestore security rules
Merge the blocks from [`firestore.rules.snippet`](firestore.rules.snippet) into your rules (**Firebase console → Firestore → Rules → Publish**). They let a signed-in user create their own one-time link code and block browsers from the bot's internal collections. **If your rules have a catch-all `match /{document=**}` that allows any signed-in user, remove it** — see the comments in the snippet.

### 8. Deploy the Worker
```bash
npm test          # 31 end-to-end tests with in-memory fakes
npx wrangler deploy
```
Note the URL it prints, e.g. `https://smart-money-telegram.<you>.workers.dev`.

### 9. Point Telegram at the Worker (webhook + secret)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://smart-money-telegram.<you>.workers.dev/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d "drop_pending_updates=true"
```
Check it: `curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"` → `url` set, no `last_error_message`.
(Run these in your own terminal; avoid pasting the token into shared places.)

### 10. Configure the app and test the bot
1. In the Vue project's `.env`, set `VITE_TELEGRAM_BOT_USERNAME=<your bot username without @>` (public, not a secret) and rebuild/redeploy the app.
2. Message your bot `/start` — it should explain how to connect.

### 11. Connect your Telegram account
1. In the app: **Settings → Telegram bot → Connect Telegram**.
2. Tap **Open Telegram** → **Start**. (Or copy the `/start CODE` command into the bot.)
3. The bot replies "Connected!" and the app shows **Connected** automatically.

Codes are random (192-bit), stored only as a SHA-256 hash, expire after 5 minutes and work once.

### 12. Disconnect safely
- In the app: **Settings → Telegram bot → Disconnect Telegram** — access stops on the next message.
- Or in Telegram: `/unlink` → **Disconnect**.
Your financial data is never deleted by disconnecting.

To shut the bot down completely: `curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"` and delete the Worker in the Cloudflare dashboard. If the token ever leaks, revoke it in BotFather (`/revoke`) and update the secret.

---

## Using the bot

**Fastest:** just type an amount — it is **saved instantly** (default):
`5` · `5 coffee` · `12.50 food lunch` · `+100` · `+100 salary` (a leading `+` means income).
The category is: the one you named → else the one you used last time for the same note → else your most-used one.
The "Saved" message offers one-tap category fixes, 🏷 Other…, 📅 Yesterday and ↩️ Undo.
Saves are tied to the Telegram message id (create-only), so a re-delivered message is never saved twice.
Prefer a confirm screen? ☰ More → ⚙️ Settings → "Ask me to confirm first" (per user).

A **keyboard at the bottom of the chat** is always available: ➖ Expense · ➕ Income · 💰 Balance · 📊 Report · 🧾 Recent · 🎯 Budget · ☰ More (send `/menu` if it's hidden).
Buttons update the same message instead of posting new ones. The confirm screen has **📅 Make it yesterday** and **🏷 Change category**; after saving you get **↩️ Undo**. Reports have ◀ ▶ month arrows.

Each update logs `update_done` with its duration (`ms`) in Cloudflare → Observability, so you can watch response times.

| Command | What it does |
|---|---|
| `/menu` | Button menu (balance, add, income, expenses, report, budgets, recent, settings, help) |
| `/balance` | Balance (income − expenses + borrowed − paid back), totals, this month |
| `/income`, `/income_today`, `/income_month` | Income this month / today |
| `/expense`, `/expense_today`, `/expense_month` | Expenses this month / today |
| `/addexpense 5 Food Lunch` · `/expense 5.50 Food Lunch` | Add an expense — **always asks to confirm** |
| `/addincome 100 Salary Monthly salary` | Add income — asks to confirm |
| `/add` | Guided: type → amount → category (buttons) → note → confirm |
| `/recent` (`/transactions`) | Last 10 transactions |
| `/delete` | Pick one of the last 10 → see details → confirm |
| `/report`, `/report_month [YYYY-MM]`, `/report_year [YYYY]` | Income, expenses, net savings, savings rate, top category, average daily spend, change vs previous period |
| `/budget`, `/budget_remaining`, `/budget_food` | This month's budgets: limit, spent, remaining, % used |
| `/cancel`, `/unlink`, `/help` | Stop current step · disconnect · help |

Amounts are entered in **USD** (the app's storage currency); results are shown in your app currency (USD or KHR).
Categories must be ones you created in the app (**More → Categories**); multi-word names work (`/addexpense 9 Food & Dining Lunch`).

## Security design

- **Webhook**: every request must carry `X-Telegram-Bot-Api-Secret-Token` (constant-time compared); otherwise 401.
- **Identity**: the acting user is always resolved from the Telegram sender id → `telegramLinks/{id}`, whose record is **HMAC-signed with `LINK_SIGNING_KEY`** (cannot be forged from a browser), and must still match `users/{uid}/settings/telegram` (so disconnecting in the app takes effect immediately). Ids inside messages or buttons are never trusted as authorisation; transaction ids from buttons are only looked up inside the resolved user's own collection.
- **Linking**: random code, hashed at rest, 5-minute expiry, consumed atomically (single use); one Telegram account ⇄ one app account.
- **Exactly-once saves**: confirmed transactions are written as `tg_<nonce>` with a create-only precondition in the same atomic commit that consumes the pending confirmation — duplicate webhook deliveries and double taps can't create duplicates.
- **Privacy**: financial replies only in private chats. Logs contain event names and error codes, never tokens, keys or amounts.
- **Least privilege**: the service account only has `Cloud Datastore User`.

## Development

```bash
npm test                 # node --test, no network: fakes for Google OAuth, Firestore REST and Telegram
npm run check            # wrangler bundle dry-run
npx wrangler dev         # local Worker (put secrets in .dev.vars — git-ignored)
```

```
src/index.js                 webhook entry: secret check, size limit, dispatch, always 200
src/telegram/commands.js     commands, buttons, guided add flow, reports, budgets, delete
src/telegram/{api,keyboards,messages}.js
src/security/linking.js      one-time codes, HMAC-signed links, resolveUser, unlink
src/security/validation.js   amount / category / description rules (match the app forms)
src/security/crypto.js       SHA-256, HMAC, constant-time compare, random tokens
src/firebase/auth.js         service-account JWT (RS256 WebCrypto) → OAuth token, cached
src/firebase/client.js       minimal Firestore REST client with atomic preconditioned commits
src/firebase/data.js         per-user data access (mirrors the app's paths)
../src/shared/finance.js     calculations shared with the Vue app
../src/shared/categories.js  built-in categories shared with the Vue app
```

## Not included yet

**Notifications** (daily summary, monthly summary, budget warnings) are intentionally postponed until the basic bot is verified in production. They'd use a free Cloudflare Cron Trigger that reads each linked user's data once a day, plus on/off switches in the app's Telegram settings.
