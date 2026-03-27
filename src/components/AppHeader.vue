<template>
  <header class="app-header">
    <router-link to="/" class="logo">Ican</router-link>

    <nav v-if="auth.isAuthenticated" class="nav">
      <router-link to="/" class="nav-link">Feed</router-link>
      <router-link to="/messages" class="nav-link messages-link">
        Messages
        <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
      </router-link>
      <router-link
        v-if="auth.profile"
        :to="`/user/${auth.profile.username}`"
        class="nav-link"
      >
        {{ auth.profile.display_name }}
      </router-link>
      <button class="logout-btn" @click="handleLogout">Quitter</button>
    </nav>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const router = useRouter()
const unreadCount = ref(0)
let pollInterval = null

async function fetchUnreadCount() {
  if (!auth.user) return
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .neq('sender_id', auth.user.id)
    .eq('read', false)
  unreadCount.value = count || 0
}

async function handleLogout() {
  await auth.signOut()
  router.push('/login')
}

onMounted(() => {
  fetchUnreadCount()
  pollInterval = setInterval(fetchUnreadCount, 15000)
})

onUnmounted(() => {
  clearInterval(pollInterval)
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
}

.logo {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;
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

.messages-link {
  position: relative;
}

.badge {
  position: absolute;
  top: -8px;
  right: -12px;
  background: var(--danger);
  color: white;
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
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
