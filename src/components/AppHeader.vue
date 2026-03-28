<template>
  <header class="app-header">
    <router-link to="/" class="logo">
      <img src="/src/assets/ican-logo.png" alt="iCAN logo" class="logo-img" />
      iCAN
    </router-link>

    <nav v-if="auth.isAuthenticated" class="nav">
      <router-link to="/" class="nav-link">Feed</router-link>

      <!-- Profile switcher -->
      <div class="profile-switcher" v-if="auth.profile">
        <button class="switcher-btn" @click="showSwitcher = !showSwitcher">
          <UserAvatar :url="auth.profile.avatar_url" :name="auth.profile.display_name" :size="24" />
          <span class="switcher-name">{{ auth.profile.display_name }}</span>
          <span class="switcher-arrow">{{ showSwitcher ? '&#9650;' : '&#9660;' }}</span>
        </button>
        <div v-if="showSwitcher" class="switcher-dropdown">
            <div class="switcher-search-container">
              <input
                v-model="searchQuery"
                class="switcher-search"
                type="text"
                placeholder="Rechercher un identifiant..."
                @click.stop
              />
            </div>
            <div class="switcher-options-list">
              <div
                v-for="p in filteredProfiles"
                :key="p.id"
                class="switcher-option"
                :class="{ active: p.id === auth.activeProfile?.id }"
                @click="selectProfile(p.id)"
              >
                <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="28" />
                <div class="switcher-option-info">
                  <span class="switcher-option-name">{{ p.display_name }}</span>
                  <span class="switcher-option-handle">@{{ p.username }}</span>
                </div>
                <span v-if="p.id === auth.activeProfile?.id" class="check">&#x2713;</span>
              </div>
            </div>
            <router-link to="/settings" class="switcher-option manage-link" @click="showSwitcher = false">
              G&eacute;rer les profils
            </router-link>
        </div>
      </div>

      <router-link to="/patch-notes" class="nav-link patchnotes-link" title="Patch Notes">&#x1F4CB;</router-link>
      <router-link to="/settings" class="nav-link settings-link" title="Param&egrave;tres">&#x2699;</router-link>
      <button class="logout-btn" @click="handleLogout">Quitter</button>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()
const showSwitcher = ref(false)

const searchQuery = ref('')
const filteredProfiles = computed(() => {
  if (!searchQuery.value) return auth.profiles
  const q = searchQuery.value.toLowerCase()
  return auth.profiles.filter(
    p => (p.id && p.id.toLowerCase().includes(q)) || (p.username && p.username.toLowerCase().includes(q))
  )
})

function selectProfile(profileId) {
  auth.switchProfile(profileId)
  showSwitcher.value = false
  router.push('/')
}

async function handleLogout() {
  await auth.signOut()
  router.push('/login')
}

function handleClickOutside(e) {
  if (!e.target.closest('.profile-switcher')) {
    showSwitcher.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  height: 52px;
}


.logo {
  display: flex;
  align-items: center;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;
  gap: 0.5rem;
}

.logo-img {
  height: 28px;
  width: 28px;
  object-fit: contain;
  margin-right: 0.2rem;
}

.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--accent);
}

.profile-switcher {
  position: relative;
}

.switcher-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.25rem 0.6rem 0.25rem 0.25rem;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
}

.switcher-btn:hover {
  border-color: var(--accent);
}

.switcher-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switcher-arrow {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.switcher-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-width: 220px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  z-index: 200;
  max-height: 700px;
  display: flex;
  flex-direction: column;
}

.switcher-search-container {
  padding: 0.5rem 0.75rem 0.25rem 0.75rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.switcher-search {
  width: 100%;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 0.9rem;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.switcher-search:focus {
  border-color: var(--accent);
}

.switcher-options-list {
  overflow-y: auto;
  max-height: 500px;
}

.switcher-options-list {
  overflow-y: auto;
  max-height: 500px;
  /* Scrollbar styles */
  scrollbar-width: thin;
  scrollbar-color: var(--accent) var(--bg-secondary);
}

/* Webkit scrollbar styles */
.switcher-options-list::-webkit-scrollbar {
  width: 8px;
  background: var(--bg-secondary);
  border-radius: 8px;
}
.switcher-options-list::-webkit-scrollbar-thumb {
  background: var(--accent);
  border-radius: 8px;
}
.switcher-options-list::-webkit-scrollbar-thumb:hover {
  background: var(--accent-dark, #2a6fa1);
}

.switcher-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
  text-decoration: none;
  color: var(--text-primary);
}

.switcher-option:hover {
  background: var(--bg-hover);
}

.switcher-option.active {
  background: var(--bg-hover);
}

.switcher-option-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.switcher-option-name {
  font-weight: 600;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switcher-option-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.check {
  color: var(--accent);
  font-size: 0.9rem;
}

.manage-link {
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
  color: var(--accent);
  justify-content: center;
}

.patchnotes-link {
  font-size: 1.1rem;
}

.settings-link {
  font-size: 1.2rem;
}

.logout-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.logout-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
