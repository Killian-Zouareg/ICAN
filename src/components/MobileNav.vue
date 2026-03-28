<template>
  <nav class="mobile-nav">
    <router-link to="/" class="mobile-nav-item" exact-active-class="active">
      <span>&#x1F3E0;</span>
    </router-link>
    <router-link to="/messages" class="mobile-nav-item" active-class="active">
      <span>&#x2709;</span>
    </router-link>
    <router-link :to="`/user/${auth.activeProfile?.username}`" class="mobile-nav-item" v-if="auth.activeProfile">
      <span>&#x1F464;</span>
    </router-link>
    <router-link to="/settings" class="mobile-nav-item" active-class="active">
      <span>&#x2699;</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<style scoped>
.mobile-nav {
  display: none;
}

@media (max-width: 768px) {
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    z-index: 100;
    justify-content: space-around;
    padding: 0.4rem 0;
  }

  .mobile-nav-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    text-decoration: none;
    font-size: 1.3rem;
    color: var(--text-secondary);
    transition: all 0.15s;
  }

  .mobile-nav-item.active {
    color: var(--accent);
  }
}
</style>
