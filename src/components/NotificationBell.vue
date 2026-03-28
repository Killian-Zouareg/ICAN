<template>
  <div class="notif-wrapper" ref="wrapperRef">
    <button class="notif-btn" @click="togglePanel" title="Notifications">
      <span class="notif-icon">&#x1F514;</span>
      <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="showPanel" class="notif-panel">
      <div class="notif-header">
        <span class="notif-title">Notifications</span>
        <button v-if="unreadCount > 0" class="notif-mark-all" @click="markAllRead">Tout lire</button>
      </div>

      <div class="notif-list">
        <div v-if="loading" class="notif-empty">Chargement...</div>
        <div v-else-if="notifications.length === 0" class="notif-empty">Aucune notification</div>
        <div
          v-for="n in notifications"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
          @click="handleClick(n)"
        >
          <UserAvatar
            :url="n.actor?.avatar_url"
            :name="n.actor?.display_name || '?'"
            :size="32"
          />
          <div class="notif-content">
            <p class="notif-text">
              <strong>{{ n.actor?.display_name || 'Quelqu\'un' }}</strong>
              {{ actionText(n.type) }}
            </p>
            <span class="notif-time">{{ timeAgo(n.created_at) }}</span>
          </div>
          <span class="notif-type-icon">{{ typeIcon(n.type) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()

const showPanel = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const loading = ref(false)
const wrapperRef = ref(null)

let pollInterval = null

function actionText(type) {
  switch (type) {
    case 'like': return 'a aim\u00e9 ton post'
    case 'comment': return 'a comment\u00e9 ton post'
    case 'reply': return 'a r\u00e9pondu \u00e0 ton commentaire'
    case 'repost': return 'a repost\u00e9 ton post'
    default: return ''
  }
}

function typeIcon(type) {
  switch (type) {
    case 'like': return '\u2764\ufe0f'
    case 'comment': return '\ud83d\udcac'
    case 'reply': return '\u21a9\ufe0f'
    case 'repost': return '\ud83d\udd01'
    default: return ''
  }
}

async function fetchNotifications() {
  if (!auth.activeProfile) return
  try {
    const profileIds = auth.profiles.map((p) => p.id)
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .in('recipient_id', profileIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error) {
      notifications.value = data || []
    }
  } catch {
    // Silently ignore
  }
}

async function fetchUnreadCount() {
  if (!auth.activeProfile) return
  try {
    const profileIds = auth.profiles.map((p) => p.id)
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .in('recipient_id', profileIds)
      .eq('read', false)

    if (!error) unreadCount.value = count || 0
  } catch {
    // Silently ignore
  }
}

function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    fetchNotifications()
  }
}

async function markAllRead() {
  if (!auth.activeProfile) return
  const profileIds = auth.profiles.map((p) => p.id)
  await supabase
    .from('notifications')
    .update({ read: true })
    .in('recipient_id', profileIds)
    .eq('read', false)

  notifications.value.forEach((n) => { n.read = true })
  unreadCount.value = 0
}

async function handleClick(n) {
  // Mark as read
  if (!n.read) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    n.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  showPanel.value = false

  // Navigate to relevant post
  if (n.post_id) {
    router.push(`/post/${n.post_id}`)
  }
}

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showPanel.value = false
  }
}

onMounted(() => {
  fetchUnreadCount()
  pollInterval = setInterval(fetchUnreadCount, 30000)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  clearInterval(pollInterval)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.notif-wrapper {
  position: relative;
}

.notif-btn {
  background: none;
  border: none;
  cursor: pointer;
  position: relative;
  font-size: 1.15rem;
  padding: 0.2rem;
  line-height: 1;
}

.notif-icon {
  filter: grayscale(0.3);
  transition: filter 0.15s;
}
.notif-btn:hover .notif-icon { filter: grayscale(0); }

.notif-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--danger);
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}

.notif-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-height: 480px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 300;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.notif-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.notif-mark-all {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8rem;
  cursor: pointer;
  font-weight: 600;
}
.notif-mark-all:hover { text-decoration: underline; }

.notif-list {
  flex: 1;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid rgba(56, 68, 77, 0.3);
}
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: var(--bg-hover); }
.notif-item.unread { background: rgba(29, 161, 242, 0.06); }

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-text {
  font-size: 0.84rem;
  line-height: 1.35;
  margin: 0;
  color: var(--text-primary);
}
.notif-text strong { color: var(--text-primary); }
.notif-item:not(.unread) .notif-text { color: var(--text-secondary); }
.notif-item:not(.unread) .notif-text strong { color: var(--text-secondary); }

.notif-time {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.notif-type-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.notif-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

@media (max-width: 600px) {
  .notif-panel {
    width: calc(100vw - 20px);
    right: -60px;
  }
}
</style>
