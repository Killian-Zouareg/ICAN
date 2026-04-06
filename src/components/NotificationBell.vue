<template>
  <div class="notif-wrapper" ref="wrapperRef">
    <button class="notif-btn" @click="togglePanel" title="Notifications">
      <svg class="notif-bell-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span v-if="totalUnread > 0" class="notif-badge">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
    </button>

    <div v-if="showPanel" class="notif-panel">
      <!-- Header -->
      <div class="notif-header">
        <span class="notif-title">Notifications</span>
        <button
          v-if="currentUnread > 0"
          class="notif-mark-all"
          @click="markAllReadForProfile"
        >
          Tout lire
        </button>
      </div>

      <!-- Profile tabs (only if multiple profiles) -->
      <div v-if="auth.profiles.length > 1" class="notif-profile-tabs">
        <button
          v-for="p in auth.profiles"
          :key="p.id"
          class="notif-profile-tab"
          :class="{ active: selectedProfileId === p.id }"
          @click="selectProfile(p.id)"
        >
          <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="20" />
          <span class="notif-profile-tab-name">{{ p.display_name }}</span>
          <span v-if="unreadByProfile[p.id] > 0" class="notif-profile-tab-badge">{{ unreadByProfile[p.id] }}</span>
        </button>
      </div>

      <!-- Type filters -->
      <div class="notif-filters">
        <button
          v-for="f in filters"
          :key="f.value"
          class="notif-filter"
          :class="{ active: activeFilter === f.value }"
          @click="activeFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- Notification list -->
      <div class="notif-list">
        <div v-if="loading" class="notif-empty">
          <div class="notif-spinner"></div>
        </div>
        <div v-else-if="filteredNotifications.length === 0" class="notif-empty">
          Aucune notification
        </div>
        <div
          v-for="n in filteredNotifications"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read }"
          @click="handleClick(n)"
        >
          <div class="notif-item-icon" :class="n.type">
            <span v-if="n.type === 'like'">&#x2764;</span>
            <span v-else-if="n.type === 'comment'">&#x1F4AC;</span>
            <span v-else-if="n.type === 'reply'">&#x21A9;</span>
            <span v-else-if="n.type === 'repost'">&#x1F501;</span>
            <span v-else-if="n.type === 'mention'">@</span>
          </div>
          <UserAvatar
            :url="n.actor?.avatar_url"
            :name="n.actor?.display_name || '?'"
            :size="36"
          />
          <div class="notif-content">
            <p class="notif-text">
              <strong>{{ n.actor?.display_name || 'Quelqu\'un' }}</strong>
              {{ actionText(n.type) }}
            </p>
            <div class="notif-meta">
              <span class="notif-time">{{ timeAgo(n.created_at) }}</span>
              <span v-if="auth.profiles.length > 1" class="notif-recipient">
                &rarr; @{{ getProfileUsername(n.recipient_id) }}
              </span>
            </div>
          </div>
          <div v-if="!n.read" class="notif-unread-dot"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()

const showPanel = ref(false)
const notifications = ref([])
const loading = ref(false)
const wrapperRef = ref(null)
const selectedProfileId = ref(null)
const activeFilter = ref('all')

const filters = [
  { label: 'Tout', value: 'all' },
  { label: 'Likes', value: 'like' },
  { label: 'Commentaires', value: 'comment' },
  { label: 'Reposts', value: 'repost' },
  { label: 'Mentions', value: 'mention' },
]

let realtimeChannel = null
const pendingFetches = new Set()

function actionText(type) {
  switch (type) {
    case 'like': return 'a aim\u00e9 ton post'
    case 'comment': return 'a comment\u00e9 ton post'
    case 'reply': return 'a r\u00e9pondu \u00e0 ton commentaire'
    case 'repost': return 'a repost\u00e9 ton post'
    case 'mention': return 't\u0027a mentionn\u00e9'
    default: return ''
  }
}

function getProfileUsername(profileId) {
  const p = auth.profiles.find((pr) => pr.id === profileId)
  return p?.username || '?'
}

// Unread count per profile
const unreadByProfile = computed(() => {
  const map = {}
  for (const p of auth.profiles) map[p.id] = 0
  for (const n of notifications.value) {
    if (!n.read && map[n.recipient_id] !== undefined) {
      map[n.recipient_id]++
    }
  }
  return map
})

// Total unread across all profiles
const totalUnread = computed(() => {
  return notifications.value.filter((n) => !n.read).length
})

// Unread for currently selected profile tab
const currentUnread = computed(() => {
  if (!selectedProfileId.value) return totalUnread.value
  return unreadByProfile.value[selectedProfileId.value] || 0
})

// Filtered notifications by profile + type
const filteredNotifications = computed(() => {
  let list = notifications.value

  // Filter by selected profile
  if (selectedProfileId.value) {
    list = list.filter((n) => n.recipient_id === selectedProfileId.value)
  }

  // Filter by type
  if (activeFilter.value !== 'all') {
    list = list.filter((n) => n.type === activeFilter.value)
  }

  return list
})

async function fetchNotifications() {
  if (!auth.activeProfile) return
  loading.value = true
  try {
    const profileIds = auth.profiles.map((p) => p.id)
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .in('recipient_id', profileIds)
      .order('created_at', { ascending: false })
      .limit(80)

    if (!error) {
      // Deduplicate by id
      const seen = new Set()
      notifications.value = (data || []).filter((n) => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
      })
    }
  } catch {
    // Silently ignore
  } finally {
    loading.value = false
  }
}

async function fetchUnreadCount() {
  if (!auth.activeProfile) return
  try {
    const profileIds = auth.profiles.map((p) => p.id)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_id, read')
      .in('recipient_id', profileIds)
      .eq('read', false)
      .limit(200)

    if (!error) {
      // Update only unread in existing list
      const unreadIds = new Set((data || []).map((n) => n.id))
      // If panel is open, we already have full data; just update read status
      if (notifications.value.length > 0) {
        for (const n of notifications.value) {
          if (unreadIds.has(n.id)) n.read = false
        }
      }
      // Keep a lightweight copy for badge count
      if (notifications.value.length === 0) {
        notifications.value = data || []
      }
    }
  } catch {
    // Silently ignore
  }
}

function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    // Default to active profile tab
    selectedProfileId.value = auth.profiles.length > 1 ? auth.activeProfile?.id : null
    activeFilter.value = 'all'
    fetchNotifications()
  }
}

async function markAllReadForProfile() {
  if (!auth.activeProfile) return

  const targetIds = selectedProfileId.value
    ? [selectedProfileId.value]
    : auth.profiles.map((p) => p.id)

  await supabase
    .from('notifications')
    .update({ read: true })
    .in('recipient_id', targetIds)
    .eq('read', false)

  for (const n of notifications.value) {
    if (targetIds.includes(n.recipient_id)) {
      n.read = true
    }
  }
}

async function handleClick(n) {
  if (!n.read) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    n.read = true
  }

  showPanel.value = false

  if (n.post_id) {
    router.push(`/post/${n.post_id}`)
  }
}

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showPanel.value = false
  }
}

async function subscribeRealtime() {
  await unsubscribeRealtime()
  const profileIds = auth.profiles.map((p) => p.id)
  if (profileIds.length === 0) return

  realtimeChannel = supabase
    .channel('notifications-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => {
        if (profileIds.includes(payload.new.recipient_id)) {
          // Fetch full notification with actor data
          fetchNewNotification(payload.new.id)
        }
      }
    )
    .subscribe()
}

async function unsubscribeRealtime() {
  if (realtimeChannel) {
    const channel = realtimeChannel
    realtimeChannel = null
    await supabase.removeChannel(channel)
  }
}

async function fetchNewNotification(notifId) {
  // Prevent concurrent fetches for the same notification
  if (pendingFetches.has(notifId)) return
  pendingFetches.add(notifId)
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .eq('id', notifId)
      .single()
    if (data) {
      // Avoid duplicates
      if (!notifications.value.find((n) => n.id === data.id)) {
        notifications.value.unshift(data)
      }
    }
  } finally {
    pendingFetches.delete(notifId)
  }
}

// Refresh notifications when switching profile
watch(() => auth.activeProfile?.id, async () => {
  if (showPanel.value) {
    selectedProfileId.value = auth.activeProfile?.id || null
    fetchNotifications()
  } else {
    fetchUnreadCount()
  }
  await subscribeRealtime()
})

onMounted(() => {
  fetchUnreadCount()
  subscribeRealtime()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  unsubscribeRealtime()
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
  padding: 0.3rem;
  line-height: 1;
  color: var(--text-secondary);
  transition: color 0.15s;
  display: flex;
  align-items: center;
}

.notif-btn:hover {
  color: var(--text-primary);
}

.notif-bell-svg {
  display: block;
}

.notif-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  background: var(--danger);
  color: white;
  font-size: 0.58rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
  border: 2px solid var(--bg-secondary);
}

/* ---- Panel ---- */
.notif-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 400px;
  max-height: 520px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
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
  font-size: 1rem;
}

.notif-mark-all {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8rem;
  cursor: pointer;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.notif-mark-all:hover {
  background: rgba(29, 161, 242, 0.1);
}

/* ---- Profile tabs ---- */
.notif-profile-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.notif-profile-tab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-family: inherit;
}

.notif-profile-tab:hover {
  background: var(--bg-hover);
}

.notif-profile-tab.active {
  background: rgba(29, 161, 242, 0.12);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.notif-profile-tab-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-profile-tab-badge {
  background: var(--danger);
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
}

/* ---- Type filters ---- */
.notif-filters {
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.notif-filter {
  padding: 0.25rem 0.6rem;
  border-radius: 16px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.notif-filter:hover {
  background: var(--bg-hover);
}

.notif-filter.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 600;
}

/* ---- List ---- */
.notif-list {
  flex: 1;
  overflow-y: auto;
}

.notif-empty {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---- Notification item ---- */
.notif-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}

.notif-item:hover {
  background: var(--bg-hover);
}

.notif-item.unread {
  background: rgba(29, 161, 242, 0.05);
}

.notif-item.unread:hover {
  background: rgba(29, 161, 242, 0.1);
}

.notif-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.notif-item-icon.like {
  background: rgba(224, 36, 94, 0.12);
  color: var(--danger);
}

.notif-item-icon.comment {
  background: rgba(29, 161, 242, 0.12);
  color: var(--accent);
}

.notif-item-icon.reply {
  background: rgba(23, 191, 99, 0.12);
  color: var(--success);
}

.notif-item-icon.repost {
  background: rgba(23, 191, 99, 0.12);
  color: var(--repost);
}

.notif-item-icon.mention {
  background: rgba(29, 161, 242, 0.12);
  color: var(--accent);
  font-weight: 700;
}

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

.notif-text strong {
  font-weight: 700;
}

.notif-item:not(.unread) .notif-text {
  color: var(--text-secondary);
}

.notif-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.notif-time {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.notif-recipient {
  font-size: 0.68rem;
  color: var(--accent);
  opacity: 0.7;
}

.notif-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

/* ---- Mobile ---- */
@media (max-width: 600px) {
  .notif-panel {
    position: fixed;
    top: var(--header-height);
    left: 0;
    right: 0;
    width: 100%;
    max-height: calc(100vh - var(--header-height) - var(--mobile-nav-height));
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}
</style>
