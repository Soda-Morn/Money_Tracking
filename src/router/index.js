import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Lazy-loaded routes — each page is a separate JS chunk loaded on demand
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/AuthPage.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomePage.vue')
  },
  {
    path: '/activity',
    name: 'Activity',
    component: () => import('../pages/ActivityPage.vue')
  },
  {
    path: '/savings',
    name: 'Savings',
    component: () => import('../pages/SavingsPage.vue')
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('../pages/AnalyticsPage.vue')
  },
  {
    path: '/loans',
    name: 'Loans',
    component: () => import('../pages/LoansPage.vue')
  },
  {
    path: '/loans/:id',
    name: 'LoanDetail',
    component: () => import('../pages/LoanDetailPage.vue')
  },
  {
    path: '/planner',
    name: 'Planner',
    component: () => import('../pages/PlannerPage.vue')
  },
  {
    path: '/more',
    name: 'More',
    component: () => import('../pages/MorePage.vue')
  },
  {
    path: '/borrow',
    redirect: '/loans'
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../pages/SettingPage.vue')
  },
  {
    path: '/settings/categories',
    name: 'Categories',
    component: () => import('../pages/CategoryPage.vue')
  },
  {
    path: '/settings/budget',
    name: 'Budget',
    component: () => import('../pages/BudgetPage.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

/**
 * After login, download the main tabs' code while the browser is idle, so the
 * first tap on Transactions / Reports / More opens instantly instead of
 * waiting for a network request. Skipped on Data Saver or 2G connections.
 */
const PREFETCH = ['Home', 'Activity', 'Analytics', 'More']
let prefetched = false
export function prefetchMainRoutes() {
  if (prefetched || typeof window === 'undefined') return
  const conn = navigator.connection
  if (conn?.saveData || /2g/.test(conn?.effectiveType || '')) return
  prefetched = true
  const run = () => routes
    .filter((r) => PREFETCH.includes(r.name) && typeof r.component === 'function')
    .forEach((r) => r.component().catch(() => { prefetched = false }))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ── Auth guard ─────────────────────────────────────────────────────────────────
// Wait for Firebase to resolve auth state before the first navigation
let authResolved = false
const waitForAuth = () =>
  new Promise((resolve) => {
    if (authResolved) return resolve(auth.currentUser)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authResolved = true
      unsubscribe()
      resolve(user)
    })
  })

router.beforeEach(async (to) => {
  const user = await waitForAuth()
  if (!user && !to.meta.public) return { name: 'Login' }
  if (user && to.meta.public)   return { name: 'Home' }
})

export default router
