import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import HomePage from '../pages/HomePage.vue'
import SavingsPage from '../pages/SavingsPage.vue'
import AnalyticsPage from '../pages/AnalyticsPage.vue'
import SettingPage from '../pages/SettingPage.vue'
import CategoryPage from '../pages/CategoryPage.vue'
import AuthPage from '../pages/AuthPage.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: AuthPage,
    meta: { public: true }
  },
  {
    path: '/',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/savings',
    name: 'Savings',
    component: SavingsPage
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: AnalyticsPage
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingPage
  },
  {
    path: '/settings/categories',
    name: 'Categories',
    component: CategoryPage
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
