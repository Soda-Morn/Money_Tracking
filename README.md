# FinanceFlow (Money Tracking)

A responsive Progressive Web App (PWA) for tracking personal income, expenses, savings, budgets and loans.
Built with Vue 3, Tailwind CSS, Chart.js and Firebase (Auth + Firestore). Available in English and Khmer, with USD or KHR display.

## Features

- **Accounts** - Email/password sign-up and login (Firebase Auth); each user only sees their own data
- **Dashboard** - Balance, monthly summary, financial health score and recent transactions
- **Transactions** - Income, expense, borrow and payback records with filters, pagination and PDF export
- **Categories** - Custom income/expense categories with icons
- **Budgets** - Monthly spending limits per category
- **Savings Goals** - Target amounts with progress tracking
- **Loans** - *Lending* (money others owe you) and *My Loans* (money you owe), with repayment schedule and payoff estimate
- **Analytics** - Category breakdown, trends and monthly comparison charts
- **Settings** - Dark mode, language (EN / KM), currency (USD / KHR), CSV export, JSON backup/restore, reset all data
- **Installable PWA** - Works on mobile and desktop

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Vue 3 (Composition API) | Frontend framework |
| Vite + vite-plugin-pwa | Build tool, dev server, PWA |
| Tailwind CSS v4 | Styling |
| Chart.js | Charts |
| Vue Router | Routing with an auth guard |
| vue-i18n | English / Khmer translations |
| Firebase Auth + Firestore | Login and real-time data storage |
| jsPDF + html2canvas | PDF export |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with **Email/Password** sign-in and **Cloud Firestore** enabled

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Firebase web-app config (`VITE_FIREBASE_*`).
   `.env` is git-ignored — never commit it.
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (output in `dist/`) |
| `npm run preview` | Preview production build |
| `node scripts/generate-icons.js` | Regenerate PWA icons |

## Project Structure

```
src/
├── components/       # UI pieces: charts, layout, loans, savings, transactions, ui (Base*)
├── composables/      # All business logic and Firestore access (shared singleton state)
├── locales/          # en.json, km.json
├── pages/            # One component per route
├── router/index.js   # Routes + auth guard (signed-out users go to /login)
├── firebase.js       # Firebase init from .env
├── i18n.js
└── main.js
```

State management uses composables with module-level `ref`s instead of Pinia: every component
calling `useTransactions()` shares the same data. Each data composable opens a Firestore
`onSnapshot` listener on login and clears its data on logout.

## Data Model (Firestore)

All data is stored per user under `users/{uid}/`:

| Path | Contents |
|------|----------|
| `transactions/` | `type` (income, expense, borrow, payback), `amount`, `category`, `name`, `date` |
| `goals/` | `name`, `targetAmount`, `currentAmount` |
| `categories/` | Custom categories: `type`, `label`, `icon`, `value` |
| `loans/` | Money the user owes: lender, amount, payment frequency, `archived` |
| `loanPayments/` | Payments linked to a loan via `loanId` |
| `settings/budgets` | `{ "YYYY-MM": { total, categories: { [category]: limit } } }` |
| `settings/preferences` | `theme`, `locale`, `currency` |

Notes:
- Amounts are always **stored in USD**; KHR is display-only (fixed rate in `useCurrency.js`).
- Dates are stored as local `YYYY-MM-DD` strings.
- Balance = income − expense + borrow − payback.

### Security rules

Firestore rules are managed in the Firebase console (not in this repo). They should only allow
each user to read and write their own documents, e.g.:

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## Backup & Restore

Settings → Data lets you:
- **Export CSV** - transactions only, for spreadsheets
- **Backup JSON** - transactions, goals, categories, budgets, loans and loan payments
- **Restore JSON** - merges a backup into the current account (older v1 backups still work)
- **Reset All Data** - permanently deletes all of the above

## License

MIT License
