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
        <router-link
          v-if="live.hasSevereAlert && route.path !== '/live'"
          to="/live"
          class="severe-alert-banner"
        >
          <span class="severe-alert-icon">&#x1F6A8;</span>
          <span class="severe-alert-text">
            <strong>{{ live.severeAlerts[0].event }}</strong>
            &mdash; {{ truncatedHeadline }}
          </span>
          <span class="severe-alert-cta">Voir &rarr;</span>
        </router-link>
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
import { useAllentownLiveStore } from './stores/allentownLive'
import AppHeader from './components/AppHeader.vue'
import SidebarNav from './components/SidebarNav.vue'
import MobileNav from './components/MobileNav.vue'
import DmWidget from './components/DmWidget.vue'
import TrendingPanel from './components/TrendingPanel.vue'

const auth = useAuthStore()
const route = useRoute()
const presence = usePresenceStore()
const live = useAllentownLiveStore()
const dmWidgetEnabled = ref(localStorage.getItem('dmWidgetEnabled') !== 'false')
const isMessagesPage = computed(() => route.path.startsWith('/messages'))
const showDmWidget = computed(() => dmWidgetEnabled.value && !isMessagesPage.value)

const truncatedHeadline = computed(() => {
  const h = live.severeAlerts[0]?.headline || ''
  return h.length > 90 ? h.slice(0, 90) + '…' : h
})

// Trigger fetch when authenticated so the banner can react app-wide
watch(
  () => auth.isAuthenticated,
  (yes) => { if (yes) live.ensureLoaded() },
  { immediate: true },
)

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

.severe-alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: linear-gradient(90deg, rgba(180, 0, 30, 0.95) 0%, rgba(224, 36, 94, 0.85) 100%);
  color: #fff;
  text-decoration: none;
  font-size: 0.85rem;
  border-bottom: 1px solid rgba(255, 215, 0, 0.4);
  animation: severe-pulse 2.4s ease-in-out infinite;
}
.severe-alert-icon { font-size: 1.1em; flex-shrink: 0; }
.severe-alert-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.severe-alert-text strong { font-weight: 700; margin-right: 4px; }
.severe-alert-cta { font-weight: 700; flex-shrink: 0; opacity: 0.95; }
.severe-alert-banner:hover { filter: brightness(1.1); }
@keyframes severe-pulse {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(255, 215, 0, 0.0); }
  50% { box-shadow: inset 0 -2px 0 0 rgba(255, 215, 0, 0.6); }
}
</style>
