<script setup>
import Navbar from './components/layout/Navbar.vue'
import MobileNav from './components/layout/MobileNav.vue'
import MobileHeader from './components/layout/MobileHeader.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Desktop Sidebar -->
    <Navbar />

    <!-- Mobile Header -->
    <MobileHeader />

    <!-- Main Content -->
    <main class="lg:pl-64 pb-20 lg:pb-0">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Mobile Bottom Navigation -->
    <MobileNav />
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
