<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login, register, error, loading } = useAuth()

const activeTab = ref('login')
const showPassword = ref(false)
const form = ref({ name: '', email: '', password: '' })

const features = [
  {
    text: 'Track income & expenses effortlessly',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  {
    text: 'Set and achieve your savings goals',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
  },
  {
    text: 'Visualize spending with analytics',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
  },
  {
    text: 'Sync data across all your devices',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
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
    <div class="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex-col justify-between p-12 relative overflow-hidden">
      <!-- Background decoration -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <!-- Logo -->
      <div class="relative z-10">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="text-white font-bold text-xl">Money Tracking</span>
        </div>
      </div>

      <!-- Center content -->
      <div class="relative z-10">
        <h2 class="text-4xl font-bold text-white leading-tight mb-4">
          Take control of<br />your finances
        </h2>
        <p class="text-blue-100 text-lg mb-10">
          Simple, powerful tools to help you track, save, and grow.
        </p>
        <div class="space-y-4">
          <div
            v-for="feature in features"
            :key="feature.text"
            class="flex items-center gap-3"
          >
            <div class="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feature.icon" />
              </svg>
            </div>
            <span class="text-blue-50 text-sm">{{ feature.text }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="relative z-10 text-blue-200/60 text-xs">© 2026 Money Tracking</p>
    </div>

    <!-- ── Right panel (form) ────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col">

      <!-- Mobile: gradient top bar -->
      <div class="lg:hidden bg-gradient-to-br from-blue-600 to-blue-800 px-6 pt-14 pb-20 flex flex-col items-center text-center">
        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">Money Tracking</h1>
        <p class="text-blue-100 text-sm mt-1">Take control of your finances</p>
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
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
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
                class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
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
                  class="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                />
                <button
                  type="button"
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  @click="showPassword = !showPassword"
                >
                  <!-- Eye off -->
                  <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  <!-- Eye -->
                  <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Submit -->
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ loading ? 'Please wait…' : (activeTab === 'login' ? 'Sign In' : 'Create Account') }}
            </button>
          </form>

          <!-- Switch tab -->
          <p class="text-center text-sm text-gray-500 mt-6">
            {{ activeTab === 'login' ? "Don't have an account?" : 'Already have an account?' }}
            <button
              class="text-blue-600 font-semibold hover:underline ml-1"
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
