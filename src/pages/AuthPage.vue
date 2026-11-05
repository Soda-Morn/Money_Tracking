<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { Wallet, PiggyBank, ChartColumn, RefreshCw, CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-vue-next'
import AppIcon from '../components/ui/AppIcon.vue'

const router = useRouter()
const { login, register, error, loading } = useAuth()

const activeTab = ref('login')
const showPassword = ref(false)
const form = ref({ name: '', email: '', password: '' })

const features = [
  {
    text: 'Track income & expenses effortlessly',
    icon: Wallet
  },
  {
    text: 'Set and achieve your savings goals',
    icon: PiggyBank
  },
  {
    text: 'Visualize spending with analytics',
    icon: ChartColumn
  },
  {
    text: 'Sync data across all your devices',
    icon: RefreshCw
  }
]

const switchTab = (tab) => {
  activeTab.value = tab
  error.value = null
  form.value = { name: '', email: '', password: '' }
  showPassword.value = false
}

const handleSubmit = async () => {
  if (activeTab.value === 'login') {
    await login(form.value.email, form.value.password)
  } else {
    await register(form.value.name, form.value.email, form.value.password)
  }
  if (!error.value) {
    router.push('/')
  }
}
</script>

<template>
  <div class="min-h-screen bg-white lg:flex">

    <!-- ── Desktop left branding panel ─────────────────────────────────── -->
    <div class="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex-col justify-between p-12 relative overflow-hidden">
      <!-- Background decoration -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <!-- Logo -->
      <div class="relative z-10">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <AppIcon :icon="Wallet" size="card" class="text-white" />
          </div>
          <span class="text-white font-bold text-xl">FinanceFlow</span>
        </div>
      </div>

      <!-- Center content -->
      <div class="relative z-10">
        <h2 class="text-4xl font-bold text-white leading-tight mb-4">
          Take control of<br />your finances
        </h2>
        <p class="text-primary-100 text-lg mb-10">
          Simple, powerful tools to help you track, save, and grow.
        </p>
        <div class="space-y-4">
          <div
            v-for="feature in features"
            :key="feature.text"
            class="flex items-center gap-3"
          >
            <div class="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
              <AppIcon :icon="feature.icon" size="action" class="text-white" />
            </div>
            <span class="text-primary-50 text-sm">{{ feature.text }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="relative z-10 text-primary-200/60 text-xs">© 2026 FinanceFlow</p>
    </div>

    <!-- ── Right panel (form) ────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col">

      <!-- Mobile: gradient top bar -->
      <div class="lg:hidden bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-14 pb-20 flex flex-col items-center text-center">
        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
          <AppIcon :icon="Wallet" :size="28" class="text-white" />
        </div>
        <h1 class="text-2xl font-bold text-white">FinanceFlow</h1>
        <p class="text-primary-100 text-sm mt-1">Take control of your finances</p>
      </div>

      <!-- Form card -->
      <div class="flex-1 flex items-start lg:items-center justify-center px-4 lg:px-12 -mt-10 lg:mt-0 pb-10 lg:pb-0">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-xl lg:shadow-none p-8">

          <!-- Tabs -->
          <div class="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              v-for="tab in ['login', 'register']"
              :key="tab"
              :class="[
                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200',
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
              @click="switchTab(tab)"
            >
              {{ tab === 'login' ? 'Sign In' : 'Create Account' }}
            </button>
          </div>

          <!-- Heading -->
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ activeTab === 'login' ? 'Welcome back' : 'Create your account' }}
            </h2>
            <p class="text-sm text-gray-500 mt-1">
              {{ activeTab === 'login'
                ? 'Sign in to access your dashboard'
                : 'Start tracking your money today' }}
            </p>
          </div>

          <!-- Error banner -->
          <Transition name="error">
            <div
              v-if="error"
              class="mb-5 flex items-center gap-2.5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100"
            >
              <AppIcon :icon="CircleAlert" size="action" />
              {{ error }}
            </div>
          </Transition>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="space-y-4">

            <!-- Full name (register only) -->
            <Transition name="field">
              <div v-if="activeTab === 'register'">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="John Doe"
                  required
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder-gray-400"
                />
              </div>
            </Transition>

            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                required
                class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder-gray-400"
              />
            </div>

            <!-- Password -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  required
                  class="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder-gray-400"
                />
                <button
                  type="button"
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <AppIcon :icon="showPassword ? EyeOff : Eye" size="button" />
                </button>
              </div>
            </div>

            <!-- Submit -->
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              <AppIcon v-if="loading" :icon="LoaderCircle" size="action" class="animate-spin" />
              {{ loading ? 'Please wait…' : (activeTab === 'login' ? 'Sign In' : 'Create Account') }}
            </button>
          </form>

          <!-- Switch tab -->
          <p class="text-center text-sm text-gray-500 mt-6">
            {{ activeTab === 'login' ? "Don't have an account?" : 'Already have an account?' }}
            <button
              class="text-primary-600 font-semibold hover:underline ml-1"
              @click="switchTab(activeTab === 'login' ? 'register' : 'login')"
            >
              {{ activeTab === 'login' ? 'Create one' : 'Sign in' }}
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-enter-active,
.error-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.field-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.field-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.field-leave-active {
  transition: opacity 0.1s ease;
}
.field-leave-to {
  opacity: 0;
}
</style>
