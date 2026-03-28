<template>
  <div v-if="auth.loading" class="loading">Chargement...</div>
  <template v-else>
    <template v-if="auth.isAuthenticated">
      <SidebarNav />
      <MobileNav />
      <div class="app-layout">
        <AppHeader />
        <div v-if="auth.isBanned" class="ban-banner">
          &#x1F6AB; Votre profil est temporairement banni jusqu'au {{ formatBanDate(auth.bannedUntil) }}.
        </div>
        <main class="container">
          <router-view />
        </main>
      </div>
      <DmWidget />
    </template>
    <template v-else>
      <main class="container">
        <router-view />
      </main>
    </template>
  </template>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import AppHeader from './components/AppHeader.vue'
import SidebarNav from './components/SidebarNav.vue'
import MobileNav from './components/MobileNav.vue'
import DmWidget from './components/DmWidget.vue'

const auth = useAuthStore()

function formatBanDate(date) {
  if (!date) return ''
  return date.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<style>
.ban-banner {
  background: rgba(239, 68, 68, 0.15);
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  text-align: center;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.app-layout {
  margin-left: 220px;
}

@media (max-width: 768px) {
  .app-layout {
    margin-left: 0;
    padding-bottom: 56px;
  }
}
</style>
