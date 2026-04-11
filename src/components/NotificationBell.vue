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
let subscriptionInProgress = false
const pendingFetches = new Set()
const recentlyAdded = new Set()

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

function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    selectedProfileId.value = auth.profiles.length > 1 ? auth.activeProfile?.id : null
    activeFilter.value = 'all'
    // Refresh on open
    fetchNotifications()
  }
}

async function markAllReadForProfile() {
  if (!auth.activeProfile) return

  const targetIds = selectedProfileId.value
    ? [selectedProfileId.value]
    : auth.profiles.map((p) => p.id)

  // Optimistic: update UI immediately
  for (const n of notifications.value) {
    if (targetIds.includes(n.recipient_id)) {
      n.read = true
    }
  }

  // Then persist to server
  supabase
    .from('notifications')
    .update({ read: true })
    .in('recipient_id', targetIds)
    .eq('read', false)
    .then()
}

async function handleClick(n) {
  // Optimistic: mark read immediately
  if (!n.read) {
    n.read = true
    supabase.from('notifications').update({ read: true }).eq('id', n.id).then()
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
  // Prevent concurrent subscriptions (mount + watch race)
  if (subscriptionInProgress) return
  subscriptionInProgress = true
  try {
    await unsubscribeRealtime()
    const profileIds = auth.profiles.map((p) => p.id)
    if (profileIds.length === 0) return

    realtimeChannel = supabase
      .channel('notifications-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (profileIds.includes(payload.new.recipient_id)) {
            fetchNewNotification(payload.new.id)
          }
        }
      )
      .subscribe()
  } finally {
    subscriptionInProgress = false
  }
}

async function unsubscribeRealtime() {
  if (realtimeChannel) {
    const channel = realtimeChannel
    realtimeChannel = null
    await supabase.removeChannel(channel)
  }
}

async function fetchNewNotification(notifId) {
  // Prevent concurrent fetches AND duplicate inserts for the same notification
  if (pendingFetches.has(notifId) || recentlyAdded.has(notifId)) return
  pendingFetches.add(notifId)
  recentlyAdded.add(notifId)
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .eq('id', notifId)
      .single()
    if (data && !notifications.value.find((n) => n.id === data.id)) {
      notifications.value.unshift(data)
    }
  } finally {
    pendingFetches.delete(notifId)
    // Keep in recentlyAdded for 10s to block late duplicates
    setTimeout(() => recentlyAdded.delete(notifId), 10000)
  }
}

// Refresh notifications when switching profile
watch(() => auth.activeProfile?.id, async () => {
  selectedProfileId.value = auth.activeProfile?.id || null
  fetchNotifications()
  await subscribeRealtime()
})

onMounted(() => {
  // Load full notifications immediately (for badge count + panel data)
  fetchNotifications()
  subscribeRealtime()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  unsubscribeRealtime()
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped src="./NotificationBell.css"></style>
