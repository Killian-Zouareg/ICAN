<template>
  <div class="admin-page">
    <div class="admin-header">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
      <h1 class="admin-title">Panel Admin</h1>
    </div>

    <!-- Tabs -->
    <div class="admin-tabs">
      <button v-for="t in tabs" :key="t.key" class="admin-tab" :class="{ active: tab === t.key }" @click="tab = t.key">
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-label">{{ t.label }}</span>
        <span v-if="t.count !== undefined" class="tab-badge">{{ t.count }}</span>
      </button>
    </div>

    <!-- ============ DASHBOARD ============ -->
    <div v-if="tab === 'dashboard'" class="admin-section">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">&#x1F465;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.accounts }}</span>
            <span class="stat-label">Comptes</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x1F464;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.profiles }}</span>
            <span class="stat-label">Profils</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x1F4DD;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.posts }}</span>
            <span class="stat-label">Posts</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x2764;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.likes }}</span>
            <span class="stat-label">Likes</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x1F4AC;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.comments }}</span>
            <span class="stat-label">Commentaires</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x2709;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.messages }}</span>
            <span class="stat-label">Messages DM</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x1F500;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.reposts }}</span>
            <span class="stat-label">Reposts</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">&#x1F4E2;</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.conversations }}</span>
            <span class="stat-label">Conversations</span>
          </div>
        </div>
      </div>

      <!-- Recent activity -->
      <h3 class="section-title">Activit&eacute; r&eacute;cente</h3>
      <div class="activity-list">
        <div v-for="a in recentActivity" :key="a.id" class="activity-item">
          <span class="activity-icon">{{ a.icon }}</span>
          <span class="activity-text">{{ a.text }}</span>
          <span class="activity-time">{{ timeAgo(a.created_at) }}</span>
        </div>
        <div v-if="recentActivity.length === 0" class="empty-state">Aucune activit&eacute; r&eacute;cente</div>
      </div>
    </div>

    <!-- ============ USERS ============ -->
    <div v-if="tab === 'users'" class="admin-section">
      <div class="section-toolbar">
        <input v-model="userSearch" class="search-input" placeholder="Rechercher un profil..." />
      </div>
      <div class="user-cards">
        <div v-for="p in filteredProfiles" :key="p.id" class="user-card" :class="{ banned: isBanned(p) }">
          <div class="user-card-top">
            <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="40" />
            <div class="user-card-info">
              <div class="user-card-name">
                <span class="bold">{{ p.display_name }}</span>
                <span v-if="p.is_admin" class="admin-tag">Admin</span>
              </div>
              <span class="muted">@{{ p.username }}</span>
            </div>
            <div class="user-card-status">
              <span v-if="isBanned(p)" class="ban-badge active" :title="'Jusqu\'au ' + formatDateTime(p.banned_until)">
                &#x1F6AB; {{ banTimeLeft(p) }}
              </span>
              <span v-else class="ban-badge ok">Actif</span>
            </div>
          </div>
          <div class="user-card-bottom">
            <span class="muted user-card-date">&#x1F4C5; {{ formatDate(p.created_at) }}</span>
            <div class="action-btns">
              <button class="toggle-btn" :class="{ on: p.is_admin }" @click="toggleAdmin(p)" :title="p.is_admin ? 'Retirer admin' : 'Rendre admin'">
                {{ p.is_admin ? '&#x1F6E1; Admin' : '&#x1F464; User' }}
              </button>
              <router-link :to="`/user/${p.username}`" class="action-btn view" title="Voir le profil">&#x1F441;</router-link>
              <button v-if="isBanned(p)" class="action-btn unban" title="D&eacute;bannir" @click="unbanProfile(p)">&#x2705;</button>
              <button v-else class="action-btn warn" title="Bannir temporairement" @click="openBanModal(p)">&#x1F6AB;</button>
              <button class="action-btn danger" title="Supprimer" @click="deleteProfile(p)">&#x1F5D1;</button>
            </div>
          </div>
        </div>
        <div v-if="filteredProfiles.length === 0" class="empty-state">Aucun profil trouv&eacute;</div>
      </div>
    </div>

    <!-- ============ CONVERSATIONS ============ -->
    <div v-if="tab === 'conversations'" class="admin-section">
      <div class="section-toolbar">
        <input v-model="convSearch" class="search-input" placeholder="Rechercher par participant..." />
      </div>
      <div class="conversations-grid">
        <div class="conv-list">
          <div
            v-for="c in filteredConversations"
            :key="c.id"
            class="conv-item"
            :class="{ active: selectedConv?.id === c.id }"
            @click="selectConversation(c)"
          >
            <div class="conv-participants">
              <template v-if="c.is_group">
                <span class="conv-group-icon">&#x1F465;</span>
                <span class="bold">{{ c.group_name || 'Groupe' }}</span>
              </template>
              <template v-else>
                <UserAvatar :url="c.user1?.avatar_url" :name="c.user1?.display_name" :size="24" />
                <span class="conv-arrow">&harr;</span>
                <UserAvatar :url="c.user2?.avatar_url" :name="c.user2?.display_name" :size="24" />
                <span class="muted conv-names">{{ c.user1?.display_name }} &amp; {{ c.user2?.display_name }}</span>
              </template>
            </div>
            <div class="conv-meta">
              <span class="muted">{{ c.messageCount }} msg</span>
              <span class="muted">{{ timeAgo(c.updated_at) }}</span>
            </div>
          </div>
          <div v-if="filteredConversations.length === 0" class="empty-state">Aucune conversation</div>
        </div>

        <!-- Message panel -->
        <div class="conv-messages">
          <template v-if="selectedConv">
            <div class="conv-messages-header">
              <template v-if="selectedConv.is_group">
                <span>&#x1F465; {{ selectedConv.group_name || 'Groupe' }}</span>
              </template>
              <template v-else>
                <span>{{ selectedConv.user1?.display_name }} &harr; {{ selectedConv.user2?.display_name }}</span>
              </template>
              <span class="muted">({{ convMessages.length }} messages)</span>
            </div>
            <div class="conv-messages-body" ref="messagesBody">
              <div v-for="m in convMessages" :key="m.id" class="msg-bubble">
                <div class="msg-header">
                  <UserAvatar :url="m.sender?.avatar_url" :name="m.sender?.display_name" :size="22" />
                  <span class="bold msg-sender">{{ m.sender?.display_name || 'Inconnu' }}</span>
                  <span class="muted msg-time">{{ formatDateTime(m.created_at) }}</span>
                </div>
                <div class="msg-content">
                  <template v-if="m.image_url">
                    <img :src="m.image_url" alt="Image" class="msg-image" />
                  </template>
                  <template v-else>{{ m.content }}</template>
                </div>
              </div>
              <div v-if="convMessages.length === 0" class="empty-state">Aucun message</div>
            </div>
          </template>
          <div v-else class="empty-state conv-empty">
            <span class="empty-icon">&#x1F4AC;</span>
            <p>S&eacute;lectionnez une conversation pour voir les messages</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ COMMENTS ============ -->
    <div v-if="tab === 'comments'" class="admin-section">
      <div class="section-toolbar">
        <input v-model="commentSearch" class="search-input" placeholder="Rechercher dans les commentaires..." />
      </div>
      <div class="comments-list">
        <div v-for="c in filteredComments" :key="c.id" class="admin-comment-card">
          <div class="comment-card-header">
            <UserAvatar :url="c.author?.avatar_url" :name="c.author?.display_name" :size="24" />
            <span class="bold">{{ c.author?.display_name || 'Inconnu' }}</span>
            <span class="muted">@{{ c.author?.username }}</span>
            <span class="muted comment-time">{{ timeAgo(c.created_at) }}</span>
          </div>
          <p class="comment-card-content">{{ c.content }}</p>
          <div class="comment-card-footer">
            <router-link :to="`/post/${c.post_id}`" class="action-btn view" title="Voir le post">&#x1F441; Voir le post</router-link>
            <button class="action-btn danger" title="Supprimer" @click="deleteComment(c)">&#x1F5D1; Supprimer</button>
          </div>
        </div>
        <div v-if="filteredComments.length === 0" class="empty-state">Aucun commentaire trouv&eacute;</div>
      </div>
    </div>

    <!-- Ban modal -->
    <div v-if="banModal.show" class="modal-overlay" @click.self="banModal.show = false">
      <div class="modal-card">
        <h3 class="modal-title">&#x1F6AB; Bannir temporairement</h3>
        <p class="modal-desc">Profil : <strong>{{ banModal.profile?.display_name }}</strong> (@{{ banModal.profile?.username }})</p>
        <div class="ban-options">
          <button v-for="opt in banDurations" :key="opt.minutes" class="ban-option" :class="{ selected: banModal.minutes === opt.minutes }" @click="banModal.minutes = opt.minutes">
            {{ opt.label }}
          </button>
        </div>
        <div class="ban-custom">
          <label class="ban-custom-label">Dur&eacute;e personnalis&eacute;e (minutes) :</label>
          <input v-model.number="banModal.minutes" type="number" min="1" class="search-input ban-custom-input" />
        </div>
        <div class="modal-actions">
          <button class="action-btn" @click="banModal.show = false">Annuler</button>
          <button class="action-btn danger-fill" @click="confirmBan">Confirmer le ban</button>
        </div>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="admin-loading">
      <div class="spinner"></div>
      Chargement...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import UserAvatar from '../components/UserAvatar.vue'
import { timeAgo } from '../lib/time'

const auth = useAuthStore()
const tab = ref('dashboard')
const loading = ref(false)
const messagesBody = ref(null)

// Search states
const userSearch = ref('')
const convSearch = ref('')
const commentSearch = ref('')

// Data
const allProfiles = ref([])
const allConversations = ref([])
const allComments = ref([])
const selectedConv = ref(null)
const convMessages = ref([])

const stats = ref({
  accounts: 0,
  profiles: 0,
  posts: 0,
  likes: 0,
  comments: 0,
  messages: 0,
  reposts: 0,
  conversations: 0,
})

const recentActivity = ref([])

// Tabs definition
const tabs = computed(() => [
  { key: 'dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { key: 'users', icon: '\u{1F465}', label: 'Utilisateurs', count: stats.value.profiles },
  { key: 'conversations', icon: '\u{1F4AC}', label: 'Conversations', count: stats.value.conversations },
  { key: 'comments', icon: '\u{1F4E3}', label: 'Commentaires', count: stats.value.comments },
])

// Filtered data
const filteredProfiles = computed(() => {
  if (!userSearch.value) return allProfiles.value
  const q = userSearch.value.toLowerCase()
  return allProfiles.value.filter(
    (p) =>
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.owner_id?.toLowerCase().includes(q),
  )
})

const filteredConversations = computed(() => {
  if (!convSearch.value) return allConversations.value
  const q = convSearch.value.toLowerCase()
  return allConversations.value.filter(
    (c) =>
      c.user1?.display_name?.toLowerCase().includes(q) ||
      c.user2?.display_name?.toLowerCase().includes(q) ||
      c.user1?.username?.toLowerCase().includes(q) ||
      c.user2?.username?.toLowerCase().includes(q) ||
      c.group_name?.toLowerCase().includes(q),
  )
})

const filteredComments = computed(() => {
  if (!commentSearch.value) return allComments.value
  const q = commentSearch.value.toLowerCase()
  return allComments.value.filter(
    (c) =>
      c.content?.toLowerCase().includes(q) ||
      c.author?.display_name?.toLowerCase().includes(q) ||
      c.author?.username?.toLowerCase().includes(q),
  )
})

// Date formatting helpers
function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============ DATA FETCHING ============

async function fetchStats() {
  const [profiles, posts, likes, comments, messages, conversations] = await Promise.all([
    supabase.from('profiles').select('owner_id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('likes').select('id', { count: 'exact', head: true }),
    supabase.from('comments').select('id', { count: 'exact', head: true }),
    supabase.from('messages').select('id', { count: 'exact', head: true }),
    supabase.from('conversations').select('id', { count: 'exact', head: true }),
  ])

  // Count unique owner_ids for accounts
  const { data: profileData } = await supabase.from('profiles').select('owner_id')
  const uniqueOwners = new Set((profileData || []).map((p) => p.owner_id))

  // Count reposts
  const { count: repostCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .not('repost_of', 'is', null)

  stats.value = {
    accounts: uniqueOwners.size,
    profiles: profiles.count || 0,
    posts: posts.count || 0,
    likes: likes.count || 0,
    comments: comments.count || 0,
    messages: messages.count || 0,
    reposts: repostCount || 0,
    conversations: conversations.count || 0,
  }
}

async function fetchProfiles() {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  allProfiles.value = data || []
}

async function fetchConversations() {
  const { data } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
      user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
    `)
    .order('updated_at', { ascending: false })

  // Count messages per conversation
  const convs = data || []
  for (const c of convs) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)
    c.messageCount = count || 0
  }
  allConversations.value = convs
}

async function fetchComments() {
  const { data } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(200)
  allComments.value = data || []
}

async function fetchRecentActivity() {
  // Fetch latest posts, comments, likes to build activity feed
  const [postsRes, commentsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, content, created_at, author:profiles!posts_author_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('comments')
      .select('id, content, created_at, author:profiles!comments_author_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('likes')
      .select('id, created_at, user:profiles!likes_user_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const activities = []

  for (const p of postsRes.data || []) {
    activities.push({
      id: 'post-' + p.id,
      icon: '\u{1F4DD}',
      text: `${p.author?.display_name || '?'} a publi\u00e9 : "${(p.content || '').slice(0, 50)}${(p.content || '').length > 50 ? '...' : ''}"`,
      created_at: p.created_at,
    })
  }
  for (const c of commentsRes.data || []) {
    activities.push({
      id: 'comment-' + c.id,
      icon: '\u{1F4AC}',
      text: `${c.author?.display_name || '?'} a comment\u00e9 : "${(c.content || '').slice(0, 50)}${(c.content || '').length > 50 ? '...' : ''}"`,
      created_at: c.created_at,
    })
  }
  for (const l of likesRes.data || []) {
    activities.push({
      id: 'like-' + l.id,
      icon: '\u{2764}',
      text: `${l.user?.display_name || '?'} a aim\u00e9 un post`,
      created_at: l.created_at,
    })
  }

  activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  recentActivity.value = activities.slice(0, 15)
}

// ============ BAN SYSTEM ============

const banModal = ref({ show: false, profile: null, minutes: 30 })

const banDurations = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 heure', minutes: 60 },
  { label: '3 heures', minutes: 180 },
  { label: '6 heures', minutes: 360 },
  { label: '12 heures', minutes: 720 },
  { label: '24 heures', minutes: 1440 },
  { label: '3 jours', minutes: 4320 },
  { label: '7 jours', minutes: 10080 },
]

function isBanned(profile) {
  if (!profile.banned_until) return false
  return new Date(profile.banned_until) > new Date()
}

function banTimeLeft(profile) {
  if (!profile.banned_until) return ''
  const diff = new Date(profile.banned_until) - new Date()
  if (diff <= 0) return 'expir\u00e9'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : ''}`
  const days = Math.floor(hours / 24)
  return `${days}j ${hours % 24}h`
}

function openBanModal(profile) {
  banModal.value = { show: true, profile, minutes: 30 }
}

async function confirmBan() {
  const p = banModal.value.profile
  if (!p || !banModal.value.minutes) return
  const bannedUntil = new Date(Date.now() + banModal.value.minutes * 60000).toISOString()
  const { error } = await supabase.rpc('admin_ban_profile', {
    p_profile_id: p.id,
    p_banned_until: bannedUntil,
  })
  if (error) {
    alert('Erreur: ' + error.message)
    return
  }
  p.banned_until = bannedUntil
  banModal.value.show = false
}

async function unbanProfile(profile) {
  const { error } = await supabase.rpc('admin_ban_profile', {
    p_profile_id: profile.id,
    p_banned_until: null,
  })
  if (error) {
    alert('Erreur: ' + error.message)
    return
  }
  profile.banned_until = null
}

// ============ ACTIONS ============

async function toggleAdmin(profile) {
  const newVal = !profile.is_admin
  const { error } = await supabase.rpc('admin_toggle_admin', {
    p_profile_id: profile.id,
    p_is_admin: newVal,
  })
  if (error) {
    alert('Erreur: ' + error.message)
    return
  }
  profile.is_admin = newVal
}

async function deleteProfile(profile) {
  if (!confirm(`Supprimer le profil "${profile.display_name}" (@${profile.username}) ? Cette action est irr\u00e9versible.`)) return
  const { error } = await supabase.from('profiles').delete().eq('id', profile.id)
  if (error) {
    alert('Erreur: ' + error.message)
    return
  }
  allProfiles.value = allProfiles.value.filter((p) => p.id !== profile.id)
  stats.value.profiles--
}

async function deleteComment(comment) {
  if (!confirm('Supprimer ce commentaire ?')) return
  const { error } = await supabase.from('comments').delete().eq('id', comment.id)
  if (error) {
    alert('Erreur: ' + error.message)
    return
  }
  allComments.value = allComments.value.filter((c) => c.id !== comment.id)
  stats.value.comments--
}

async function selectConversation(conv) {
  selectedConv.value = conv
  const { data } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
  convMessages.value = data || []
  await nextTick()
  if (messagesBody.value) {
    messagesBody.value.scrollTop = messagesBody.value.scrollHeight
  }
}

// ============ INIT ============

onMounted(async () => {
  loading.value = true
  await Promise.all([
    fetchStats(),
    fetchProfiles(),
    fetchConversations(),
    fetchComments(),
    fetchRecentActivity(),
  ])
  loading.value = false
})
</script>

<style scoped>
.admin-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem;
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.back-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.admin-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Tabs */
.admin-tabs {
  display: flex;
  gap: 0.3rem;
  background: var(--bg-secondary);
  padding: 0.35rem;
  border-radius: 12px;
  margin-bottom: 1.2rem;
  overflow-x: auto;
}

.admin-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: none;
  background: none;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
  transition: all 0.15s;
}

.admin-tab:hover {
  background: var(--bg-hover);
}

.admin-tab.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.tab-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.admin-tab:not(.active) .tab-badge {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

/* Sections */
.admin-section {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-toolbar {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  max-width: 400px;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.5rem 0 0.8rem;
  color: var(--text-primary);
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.8rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  transition: border-color 0.15s;
}

.stat-card:hover {
  border-color: var(--accent);
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Activity list */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 0.85rem;
}

.activity-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.activity-text {
  flex: 1;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  color: var(--text-secondary);
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* User cards */
.user-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
  transition: border-color 0.15s;
}

.user-card:hover {
  border-color: var(--accent);
}

.user-card.banned {
  border-color: rgba(239, 68, 68, 0.3);
  opacity: 0.75;
}

.user-card-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.user-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-card-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.admin-tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  text-transform: uppercase;
}

.user-card-status {
  flex-shrink: 0;
}

.user-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border);
}

.user-card-date {
  font-size: 0.75rem;
}

.bold {
  font-weight: 600;
}

.muted {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.mono {
  font-family: monospace;
  font-size: 0.75rem;
}

/* Toggle button */
.toggle-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.toggle-btn.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* Action buttons */
.action-btns {
  display: flex;
  gap: 0.3rem;
}

.action-btn {
  padding: 0.25rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: none;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.action-btn.view:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.action-btn.danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}

/* Ban system */
.ban-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
}

.ban-badge.active {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.ban-badge.ok {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.action-btn.warn {
  color: #f59e0b;
}

.action-btn.warn:hover {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.action-btn.unban {
  color: #22c55e;
}

.action-btn.unban:hover {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

/* Ban modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  width: 90%;
  max-width: 440px;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.modal-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.ban-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.ban-option {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}

.ban-option:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ban-option.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.ban-custom {
  margin-bottom: 1.2rem;
}

.ban-custom-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 0.3rem;
}

.ban-custom-input {
  max-width: 140px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.action-btn.danger-fill {
  background: #ef4444;
  border-color: #ef4444;
  color: #fff;
  padding: 0.4rem 0.8rem;
}

.action-btn.danger-fill:hover {
  background: #dc2626;
}

/* Conversations */
.conversations-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 0.8rem;
  height: 500px;
}

.conv-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem;
  background: var(--bg-secondary);
}

.conv-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.conv-item:hover {
  background: var(--bg-hover);
}

.conv-item.active {
  background: var(--bg-hover);
  border-left: 3px solid var(--accent);
}

.conv-participants {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.conv-arrow {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.conv-names {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-group-icon {
  font-size: 1.1rem;
}

.conv-meta {
  display: flex;
  gap: 0.6rem;
  font-size: 0.75rem;
}

/* Messages panel */
.conv-messages {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.conv-messages-header {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.conv-messages-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.msg-bubble {
  padding: 0.5rem 0.7rem;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.msg-sender {
  font-size: 0.8rem;
}

.msg-time {
  font-size: 0.7rem;
  margin-left: auto;
}

.msg-content {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.msg-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 6px;
  margin-top: 0.3rem;
}

.conv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.3;
}

/* Comments */
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.admin-comment-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem;
}

.comment-card-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.comment-time {
  margin-left: auto;
}

.comment-card-content {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.4;
  margin: 0 0 0.5rem;
}

.comment-card-footer {
  display: flex;
  gap: 0.5rem;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Loading */
.admin-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 1rem;
  z-index: 1000;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .conversations-grid {
    grid-template-columns: 1fr;
    height: auto;
  }

  .conv-messages {
    min-height: 300px;
  }

  .admin-tabs {
    gap: 0.2rem;
  }

  .admin-tab {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .tab-label {
    display: none;
  }

  .tab-icon {
    font-size: 1.1rem;
  }
}
</style>
