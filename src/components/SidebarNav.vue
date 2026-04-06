<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <!-- Logo -->
      <router-link to="/" class="sidebar-logo">
        <img src="/src/assets/ican-logo.png" alt="iCAN" class="sidebar-logo-img" />
        <span class="sidebar-logo-text">iCAN</span>
      </router-link>

      <!-- Nav links -->
      <nav class="sidebar-nav">
        <router-link to="/" class="sidebar-link" exact-active-class="active">
          <span class="sidebar-icon">&#x1F3E0;</span>
          <span class="sidebar-label">Feed</span>
        </router-link>
        <router-link to="/search" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F50D;</span>
          <span class="sidebar-label">Recherche</span>
        </router-link>
        <router-link to="/messages" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x2709;</span>
          <span class="sidebar-label">Messages</span>
          <span v-if="unreadCount > 0" class="sidebar-badge">{{ unreadCount }}</span>
        </router-link>
        <router-link :to="`/user/${auth.activeProfile?.username}`" class="sidebar-link" v-if="auth.activeProfile">
          <span class="sidebar-icon">&#x1F464;</span>
          <span class="sidebar-label">Profil</span>
        </router-link>
        <router-link to="/map" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F5FA;</span>
          <span class="sidebar-label">Carte</span>
        </router-link>
        <router-link :to="`/character/${auth.activeProfile?.username}`" class="sidebar-link" v-if="auth.activeProfile" active-class="active">
          <span class="sidebar-icon">&#x1F9D9;</span>
          <span class="sidebar-label">iCharacter</span>
        </router-link>
        <router-link to="/bank" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F3E6;</span>
          <span class="sidebar-label">iBank</span>
        </router-link>
        <router-link to="/settings" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x2699;</span>
          <span class="sidebar-label">Param&egrave;tres</span>
        </router-link>
        <router-link to="/patch-notes" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F4CB;</span>
          <span class="sidebar-label">Patch Notes</span>
        </router-link>
        <router-link v-if="auth.isAdmin" to="/admin" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F6E1;</span>
          <span class="sidebar-label">Admin</span>
        </router-link>
      </nav>
    </div>

    <!-- Profile card at bottom -->
    <div class="sidebar-bottom">
      <div class="sidebar-profile" @click="showSwitcher = !showSwitcher">
        <UserAvatar :url="auth.activeProfile?.avatar_url" :name="auth.activeProfile?.display_name" :size="36" />
        <div class="sidebar-profile-info">
          <span class="sidebar-profile-name">{{ auth.activeProfile?.display_name }}</span>
          <span class="sidebar-profile-handle">@{{ auth.activeProfile?.username }}</span>
        </div>
        <span class="sidebar-profile-dots">&#x22EF;</span>
      </div>

      <!-- Profile switcher dropdown -->
      <div v-if="showSwitcher" class="sidebar-switcher">
        <div class="switcher-search-wrap">
          <input v-model="searchQuery" class="switcher-search" type="text"
            placeholder="Rechercher un profil..." @click.stop />
        </div>
        <div class="switcher-list">
          <div v-for="p in filteredProfiles" :key="p.id" class="switcher-item"
            :class="{ active: p.id === auth.activeProfile?.id }" @click="selectProfile(p.id)">
            <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="32" />
            <div class="switcher-item-info">
              <span class="switcher-item-name">{{ p.display_name }}</span>
              <span class="switcher-item-handle">@{{ p.username }}</span>
            </div>
            <span v-if="unreadByProfile[p.id] > 0" class="switcher-badge">{{ unreadByProfile[p.id] }}</span>
            <span v-if="p.id === auth.activeProfile?.id" class="switcher-check">&#x2713;</span>
          </div>
        </div>
        <router-link to="/settings" class="switcher-manage" @click="showSwitcher = false">
          G&eacute;rer les profils
        </router-link>
      </div>

      <button class="sidebar-logout" @click="handleLogout">
        <span class="sidebar-icon">&#x1F6AA;</span>
        <span class="sidebar-label">Quitter</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()
const showSwitcher = ref(false)
const searchQuery = ref('')
const unreadCount = ref(0)
const unreadByProfile = ref({})

const filteredProfiles = computed(() => {
  if (!searchQuery.value) return auth.profiles
  const q = searchQuery.value.toLowerCase()
  return auth.profiles.filter(
    p => p.username?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q)
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

async function fetchUnread() {
  if (!auth.activeProfile || auth.profiles.length === 0) return
  try {
    const allProfileIds = auth.profiles.map((p) => p.id)
    const counts = {}
    for (const pid of allProfileIds) counts[pid] = 0

    // 1. Get ALL conversations for all profiles at once
    const { data: dmConvs } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id')
      .eq('is_group', false)
      .or(allProfileIds.map(pid => `user1_id.eq.${pid},user2_id.eq.${pid}`).join(','))

    const { data: groupParts } = await supabase
      .from('conversation_members')
      .select('conversation_id, profile_id')
      .in('profile_id', allProfileIds)

    // 2. Build per-profile conversation sets
    const convsByProfile = {}
    for (const pid of allProfileIds) convsByProfile[pid] = new Set()

    for (const c of (dmConvs || [])) {
      if (allProfileIds.includes(c.user1_id)) convsByProfile[c.user1_id].add(c.id)
      if (allProfileIds.includes(c.user2_id)) convsByProfile[c.user2_id].add(c.id)
    }
    for (const p of (groupParts || [])) {
      if (convsByProfile[p.profile_id]) convsByProfile[p.profile_id].add(p.conversation_id)
    }

    // 3. Get all unread messages at once for all conversations
    const allConvIds = [...new Set([
      ...(dmConvs || []).map(c => c.id),
      ...(groupParts || []).map(p => p.conversation_id),
    ])]

    if (allConvIds.length === 0) {
      unreadByProfile.value = counts
      unreadCount.value = 0
      return
    }

    const { data: unreads } = await supabase
      .from('messages')
      .select('conversation_id, sender_id')
      .in('conversation_id', allConvIds)
      .not('sender_id', 'in', `(${allProfileIds.join(',')})`)
      .eq('read', false)

    // 4. Attribute unread messages to each profile
    for (const msg of (unreads || [])) {
      for (const pid of allProfileIds) {
        if (convsByProfile[pid].has(msg.conversation_id)) {
          counts[pid]++
        }
      }
    }

    unreadByProfile.value = counts
    unreadCount.value = counts[auth.activeProfile.id] || 0
  } catch { /* ignore */ }
}

let unreadInterval = null

function handleClickOutside(e) {
  if (!e.target.closest('.sidebar-bottom')) {
    showSwitcher.value = false
  }
}

// Re-fetch when auth loads or profile switches
watch(() => auth.activeProfile?.id, () => {
  fetchUnread()
})

function onDmReadUpdate() {
  fetchUnread()
}

onMounted(() => {
  fetchUnread()
  unreadInterval = setInterval(fetchUnread, 30000)
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('dm-read-update', onDmReadUpdate)
})

onUnmounted(() => {
  clearInterval(unreadInterval)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('dm-read-update', onDmReadUpdate)
})
</script>

<style scoped>
.sidebar {
  width: 220px;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 0.75rem;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-top {
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--accent);
  font-weight: 700;
  font-size: 1.2rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 0.75rem;
}

.sidebar-logo-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: background 0.15s;
}

.sidebar-link:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.sidebar-link.active {
  background: var(--bg-hover);
  font-weight: 700;
  color: var(--accent);
}

.sidebar-icon {
  font-size: 1.15rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-label {
  white-space: nowrap;
}

.sidebar-badge {
  margin-left: auto;
  background: var(--accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* Bottom section */
.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  position: relative;
}

.sidebar-profile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.sidebar-profile:hover {
  background: var(--bg-hover);
}

.sidebar-profile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-profile-name {
  font-weight: 600;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-profile-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sidebar-profile-dots {
  color: var(--text-secondary);
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* Switcher dropdown */
.sidebar-switcher {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  z-index: 200;
}

.switcher-search-wrap {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.switcher-search {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.switcher-search:focus {
  border-color: var(--accent);
}

.switcher-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 0.25rem;
}

.switcher-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.switcher-item:hover {
  background: var(--bg-hover);
}

.switcher-item.active {
  background: var(--bg-hover);
}

.switcher-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.switcher-item-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.switcher-item-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.switcher-badge {
  background: var(--danger);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.switcher-check {
  color: var(--accent);
  font-size: 0.85rem;
}

.switcher-manage {
  display: block;
  text-align: center;
  padding: 0.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
}

.switcher-manage:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.sidebar-logout {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: left;
}

.sidebar-logout:hover {
  background: rgba(224, 36, 94, 0.1);
  color: var(--danger);
}

/* Mobile: hide sidebar, show bottom nav */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
