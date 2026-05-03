<template>
  <header class="app-header">
    <div class="header-left">
      <router-link to="/" class="mobile-logo">
        <img src="/src/assets/ican-logo.png" alt="iCAN" class="mobile-logo-img" />
        iCAN
      </router-link>
    </div>
    <div class="header-right">
      <NotificationBell />
    </div>
  </header>
</template>

<script setup>
import NotificationBell from './NotificationBell.vue'
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  padding-top: calc(0.5rem + var(--safe-top));
  padding-left: calc(1rem + var(--safe-left));
  padding-right: calc(1rem + var(--safe-right));
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 50;
  height: calc(48px + var(--safe-top));
}

.header-left {
  display: flex;
  align-items: center;
}

.mobile-logo {
  display: none;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  color: var(--accent);
  font-weight: 700;
  font-size: 1.1rem;
}

.mobile-logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

@media (max-width: 768px) {
  .mobile-logo {
    display: flex;
  }
}
</style>
