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
        <router-link to="/igames" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F3AE;</span>
          <span class="sidebar-label">iGames</span>
        </router-link>
        <router-link to="/game" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F30D;</span>
          <span class="sidebar-label">Hub 3D</span>
        </router-link>
        <router-link to="/wiki" class="sidebar-link" active-class="active">
          <span class="sidebar-icon">&#x1F4D6;</span>
          <span class="sidebar-label">iWiki</span>
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

<style scoped src="./SidebarNav.css"></style>
