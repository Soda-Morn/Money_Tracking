# Money Tracking

A modern, responsive Progressive Web App (PWA) for tracking personal income and expenses. Built with Vue 3, Tailwind CSS, and Chart.js.

## Features

- **Dashboard** - View total balance, income, and expenses at a glance
- **Transaction Management** - Add, edit, and delete income/expense transactions
- **Categories** - Organize transactions by category (Food, Transport, Shopping, Salary, etc.)
- **Savings Goals** - Set and track savings goals with progress visualization
- **Analytics** - Visualize spending patterns with interactive charts
- **Offline Support** - Works offline as a PWA
- **Installable** - Install as a native app on mobile and desktop
- **Responsive Design** - Optimized for both mobile and desktop
- **Local Storage** - All data stored locally in your browser

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Vue 3 | Frontend framework with Composition API |
| Vite | Build tool and dev server |
| Tailwind CSS v4 | Utility-first CSS framework |
| Chart.js | Interactive charts and graphs |
| Vue Router | Client-side routing |
| LocalStorage | Data persistence |
| VitePWA | Progressive Web App support |

## Project Structure

```
money-tracking/
├── public/
│   ├── icons/                 # PWA icons
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── favicon.svg
│   └── manifest.json          # PWA manifest
├── src/
│   ├── components/
│   │   ├── charts/            # Chart components
│   │   │   ├── BarChart.vue
│   │   │   ├── ExpenseChart.vue
│   │   │   └── TrendChart.vue
│   │   ├── layout/            # Layout components
│   │   │   ├── MobileHeader.vue
│   │   │   ├── MobileNav.vue
│   │   │   └── Navbar.vue
│   │   ├── savings/           # Savings goal components
│   │   │   ├── AddMoneyForm.vue
│   │   │   ├── GoalCard.vue
│   │   │   └── GoalForm.vue
│   │   ├── transactions/      # Transaction components
│   │   │   ├── SummaryCards.vue
│   │   │   ├── TransactionForm.vue
│   │   │   ├── TransactionItem.vue
│   │   │   └── TransactionList.vue
│   │   └── ui/                # Reusable UI components
│   │       ├── BaseButton.vue
│   │       ├── BaseCard.vue
│   │       ├── BaseInput.vue
│   │       ├── BaseModal.vue
│   │       ├── BaseSelect.vue
│   │       ├── EmptyState.vue
│   │       └── ProgressBar.vue
│   ├── composables/           # Reusable logic
│   │   ├── useFormat.js       # Currency/date formatting
│   │   ├── useSavingsGoals.js # Savings goals management
│   │   ├── useStorage.js      # LocalStorage sync
│   │   └── useTransactions.js # Transaction management
│   ├── pages/                 # Page components
│   │   ├── AnalyticsPage.vue
│   │   ├── HomePage.vue
│   │   └── SavingsPage.vue
│   ├── router/
│   │   └── index.js           # Vue Router config
│   ├── App.vue                # Root component
│   ├── main.js                # App entry point
│   └── style.css              # Global styles
├── scripts/
│   └── generate-icons.js      # PWA icon generator
├── index.html
├── vite.config.js
├── postcss.config.js
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone or download the project

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

Or use serve:
```bash
npm install -g serve
serve dist
```

## Pages

### Home (Dashboard)
- View total balance, income, and expenses
- Add new transactions (income or expense)
- View recent transactions grouped by date
- Edit or delete existing transactions

### Savings Goals
- Create savings goals with target amounts
- Track progress with visual progress bars
- Add money to goals
- Mark goals as completed

### Analytics
- Expense breakdown by category (doughnut chart)
- Income breakdown by category (doughnut chart)
- Daily trend chart (last 14 days)
- Monthly comparison (bar chart)
- Top spending categories
- Overall summary

## PWA Features

### Installation

**Desktop (Chrome/Edge):**
1. Open the app
2. Click the install icon in the address bar
3. Click "Install"

**Mobile (Android):**
1. Open the app in Chrome
2. Tap "Add to Home Screen" in the menu
3. Tap "Add"

**Mobile (iOS):**
1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

### Offline Support

The app works offline after the first visit. All data is stored locally in your browser's LocalStorage.

## Data Storage

All data is stored in the browser's LocalStorage:

| Key | Description |
|-----|-------------|
| `money-tracking-transactions` | All income/expense transactions |
| `money-tracking-goals` | Savings goals data |

### Export Data

Open browser DevTools > Application > LocalStorage to view or export your data.

## Customization

### Theme Colors

The app uses a blue, white, and black color scheme. To customize:

1. Edit `src/style.css` for global styles
2. Edit Tailwind classes in components
3. Update `theme_color` in `vite.config.js` and `public/manifest.json`

### Categories

To add or modify transaction categories, edit:
- `src/components/transactions/TransactionForm.vue` - Category options
- `src/components/transactions/TransactionItem.vue` - Category icons and labels
- `src/components/charts/ExpenseChart.vue` - Category colors for charts

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `node scripts/generate-icons.js` | Regenerate PWA icons |

## Browser Support

- Chrome (recommended)
- Edge
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome for Android)

## License

MIT License - Feel free to use and modify for your own projects.
