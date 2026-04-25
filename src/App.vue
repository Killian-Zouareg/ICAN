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
      <TrendingPanel />
      <DmWidget v-if="showDmWidget" />
    </template>
    <template v-else>
      <main class="container">
        <router-view />
      </main>
    </template>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { usePresenceStore, pathToSection } from './stores/presence'
import AppHeader from './components/AppHeader.vue'
import SidebarNav from './components/SidebarNav.vue'
import MobileNav from './components/MobileNav.vue'
import DmWidget from './components/DmWidget.vue'
import TrendingPanel from './components/TrendingPanel.vue'

const auth = useAuthStore()
const route = useRoute()
const presence = usePresenceStore()
const dmWidgetEnabled = ref(localStorage.getItem('dmWidgetEnabled') !== 'false')
const isMessagesPage = computed(() => route.path.startsWith('/messages'))
const showDmWidget = computed(() => dmWidgetEnabled.value && !isMessagesPage.value)

watch(
  () => auth.activeProfile?.id,
  (id) => {
    if (id) {
      presence.start(id)
      presence.setSection(pathToSection(route.path))
    } else {
      presence.stop()
    }
  },
  { immediate: true },
)

watch(
  () => route.path,
  (path) => {
    if (auth.activeProfile?.id) presence.setSection(pathToSection(path))
  },
)

function onDmWidgetToggle(e) {
  dmWidgetEnabled.value = e.detail
}

onMounted(() => {
  window.addEventListener('dm-widget-toggle', onDmWidgetToggle)
})

onUnmounted(() => {
  window.removeEventListener('dm-widget-toggle', onDmWidgetToggle)
})

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
  margin-right: 280px;
}

@media (max-width: 1100px) {
  .app-layout {
    margin-right: 0;
  }
}

@media (max-width: 768px) {
  .app-layout {
    margin-left: 0;
    margin-right: 0;
    padding-bottom: 56px;
  }
}
</style>
