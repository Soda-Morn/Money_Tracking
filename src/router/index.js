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
    path: '/borrow',
    name: 'Borrow',
    component: () => import('../pages/BorrowPage.vue')
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
