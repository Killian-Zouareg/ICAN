<template>
  <div class="profile-page">
    <!-- Top bar -->
    <div class="profile-top-bar">
      <button @click="$router.back()" class="back-btn">&larr;</button>
      <div v-if="profileData" class="top-bar-info">
        <span class="top-bar-name">{{ profileData.display_name }}</span>
        <span class="top-bar-count">{{ stats.posts }} post{{ stats.posts !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else-if="profileData">

      <!-- Banner + Avatar -->
      <div class="profile-banner">
        <div class="banner-gradient" :style="heroBannerStyle"></div>
      </div>
      <div class="profile-avatar-row">
        <div class="avatar-wrapper" @click="openAvatarViewer" :class="{ clickable: profileData.avatar_url, 'hero-glow': profileData.is_hero }" :style="profileData.is_hero ? { '--hero-primary': profileData.hero_color_primary || '#FFD700' } : {}">
          <UserAvatar :url="profileData.avatar_url" :name="profileData.display_name" :size="120" />
        </div>
        <div class="profile-actions">
          <button
            v-if="!isOwnProfile"
            class="action-dm-btn"
            @click="startDM"
            title="Envoyer un message"
          >
            &#x2709;
          </button>
          <router-link
            v-if="isOwnProfile"
            to="/settings"
            class="edit-profile-btn"
          >
            Modifier le profil
          </router-link>
        </div>
      </div>

      <!-- Profile info -->
      <div class="profile-info">
        <div class="profile-names">
          <h2 class="display-name">
            {{ profileData.display_name }}
            <span v-if="profileData.is_hero" class="hero-badge">Hero</span>
            <span v-else-if="profileData.is_admin" class="admin-badge">Admin</span>
          </h2>
          <span class="username">@{{ profileData.username }}</span>
        </div>

        <p v-if="profileData.bio" class="bio">{{ profileData.bio }}</p>

        <div class="profile-meta">
          <span class="meta-item">
            <span class="meta-icon">&#x1F4C5;</span>
            Rejoint le {{ joinedDate }}
          </span>
        </div>

        <div class="profile-stats">
          <span class="stat">
            <strong>{{ stats.posts }}</strong> Posts
          </span>
          <span class="stat">
            <strong>{{ stats.likes }}</strong> J'aime
          </span>
          <span v-if="profileData.show_balance && bankBalance !== null" class="stat stat-balance">
            <strong>${{ formatBalance(bankBalance) }}</strong> iBank
          </span>
        </div>
      </div>

      <!-- Character Sheet Card -->
      <div v-if="characterSheet" class="character-card" @click="goToCharacter">
        <div class="character-card-left">
          <img v-if="characterSheet.photo_url" :src="characterSheet.photo_url" class="character-card-photo" />
          <div v-else class="character-card-photo-placeholder">&#x1F9D9;</div>
          <div class="character-card-identity">
            <span class="character-card-name">{{ characterSheet.prenom }} {{ characterSheet.nom }}</span>
            <span class="character-card-details" v-if="characterSheet.nationalite || characterSheet.sexe">
              {{ [characterSheet.sexe, characterSheet.nationalite].filter(Boolean).join(' &middot; ') }}
            </span>
          </div>
        </div>
        <div class="character-card-stats">
          <StatsRadarChart :stats="characterSheetStats" :size="120" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="profile-tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'posts' }"
          @click="activeTab = 'posts'"
        >
          Posts
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'reposts' }"
          @click="switchTab('reposts')"
        >
          Reposts
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'likes' }"
          @click="switchTab('likes')"
        >
          J'aime
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'media' }"
          @click="switchTab('media')"
        >
          M&eacute;dias
        </button>
      </div>

      <!-- Tab content -->
      <div class="tab-content">
        <div v-if="tabLoading" class="loading">Chargement...</div>

        <!-- Posts tab -->
        <template v-else-if="activeTab === 'posts'">
          <div v-if="postsStore.posts.length === 0" class="empty">Aucun post</div>
          <PostCard
            v-for="post in postsStore.posts"
            :key="post.id"
            :post="post"
            @comment="goToPost"
          />
        </template>

        <!-- Reposts tab -->
        <template v-else-if="activeTab === 'reposts'">
          <div v-if="reposts.length === 0" class="empty">Aucun repost</div>
          <PostCard
            v-for="post in reposts"
            :key="post.id"
            :post="post"
            @comment="goToPost"
          />
        </template>

        <!-- Likes tab -->
        <template v-else-if="activeTab === 'likes'">
          <div v-if="likedPosts.length === 0" class="empty">Aucun post aim&eacute;</div>
          <PostCard
            v-for="post in likedPosts"
            :key="post.id"
            :post="post"
            @comment="goToPost"
          />
        </template>

        <!-- Media tab -->
        <template v-else-if="activeTab === 'media'">
          <div v-if="mediaPosts.length === 0" class="empty">Aucun m&eacute;dia</div>
          <div v-else class="media-grid">
            <div
              v-for="post in mediaPosts"
              :key="post.id"
              class="media-item"
              @click="goToPost(post.id)"
            >
              <img :src="post.image_url" :alt="'Image de ' + profileData.display_name" />
            </div>
          </div>
        </template>
      </div>

    </template>
    <div v-else class="empty">Utilisateur introuvable</div>

    <!-- Avatar lightbox -->
    <Teleport to="body">
      <div v-if="showAvatarViewer" class="avatar-lightbox" @click="showAvatarViewer = false">
        <button class="lightbox-close" @click.stop="showAvatarViewer = false">&times;</button>
        <div class="lightbox-content" @click.stop>
          <img :src="profileData?.avatar_url" :alt="profileData?.display_name" />
          <div class="lightbox-info">
            <span class="lightbox-name">{{ profileData?.display_name }}</span>
            <span class="lightbox-handle">@{{ profileData?.username }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'
import PostCard from '../components/PostCard.vue'
import UserAvatar from '../components/UserAvatar.vue'
import StatsRadarChart from '../components/StatsRadarChart.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const postsStore = usePostsStore()

const profileData = ref(null)
const loading = ref(true)
const activeTab = ref('posts')
const tabLoading = ref(false)

const reposts = ref([])
const likedPosts = ref([])
const mediaPosts = ref([])
const showAvatarViewer = ref(false)
const characterSheet = ref(null)
const bankBalance = ref(null)

const stats = ref({ posts: 0, likes: 0 })

const characterSheetStats = computed(() => ({
  force: characterSheet.value?.force || 0,
  defense: characterSheet.value?.defense || 0,
  endurance: characterSheet.value?.endurance || 0,
  intellect: characterSheet.value?.intellect || 0,
  charisme: characterSheet.value?.charisme || 0,
}))

const isOwnProfile = computed(() => {
  if (!profileData.value) return false
  return auth.profiles.some((p) => p.id === profileData.value.id)
})

const heroBannerStyle = computed(() => {
  if (!profileData.value?.is_hero) return {}
  const p = profileData.value.hero_color_primary || '#FFD700'
  const s = profileData.value.hero_color_secondary || '#FF6B00'
  return {
    background: `linear-gradient(135deg, ${p}44 0%, ${s}33 50%, ${p}55 100%)`,
  }
})

const joinedDate = computed(() => {
  if (!profileData.value?.created_at) return ''
  return new Date(profileData.value.created_at).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
})

async function loadProfile() {
  loading.value = true
  activeTab.value = 'posts'
  reposts.value = []
  likedPosts.value = []
  mediaPosts.value = []
  characterSheet.value = null
  bankBalance.value = null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', route.params.username)
    .single()
  profileData.value = data

  if (data) {
    await postsStore.fetchUserPosts(data.id)
    await fetchStats(data.id)

    // Load character sheet
    const { data: sheet } = await supabase
      .from('character_sheets')
      .select('*')
      .eq('profile_id', data.id)
      .maybeSingle()
    characterSheet.value = sheet

    // Load bank balance if profile has show_balance enabled
    if (data.show_balance) {
      const { data: account } = await supabase
        .from('bank_accounts')
        .select('balance')
        .eq('profile_id', data.id)
        .maybeSingle()
      bankBalance.value = account?.balance ?? null
    }
  }
  loading.value = false
}

function formatBalance(n) {
  return Number(n || 0).toLocaleString('fr-FR')
}

function goToCharacter() {
  if (profileData.value) {
    router.push(`/character/${profileData.value.username}`)
  }
}

async function fetchStats(profileId) {
  const [postsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', profileId)
      .is('repost_of', null),
    supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileId),
  ])
  stats.value = {
    posts: postsRes.count || 0,
    likes: likesRes.count || 0,
  }
}

async function switchTab(tab) {
  activeTab.value = tab
  if (!profileData.value) return

  const profileId = profileData.value.id

  if (tab === 'reposts' && reposts.value.length === 0) {
    tabLoading.value = true
    const { data } = await supabase
      .from('posts_with_stats')
      .select('*')
      .eq('author_id', profileId)
      .not('repost_of', 'is', null)
      .order('created_at', { ascending: false })

    // Enrich reposts with original post data
    const enriched = data || []
    const repostIds = enriched.map((p) => p.repost_of).filter(Boolean)
    if (repostIds.length > 0) {
      const { data: originals } = await supabase
        .from('posts_with_stats')
        .select('*')
        .in('id', [...new Set(repostIds)])
      const originalsMap = {}
      ;(originals || []).forEach((p) => { originalsMap[p.id] = p })
      reposts.value = enriched.map((p) => ({
        ...p,
        _original: originalsMap[p.repost_of] || null,
      }))
    } else {
      reposts.value = enriched
    }
    tabLoading.value = false
  }

  if (tab === 'likes' && likedPosts.value.length === 0) {
    tabLoading.value = true
    const { data: likes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (likes && likes.length > 0) {
      const postIds = likes.map((l) => l.post_id)
      const { data: posts } = await supabase
        .from('posts_with_stats')
        .select('*')
        .in('id', postIds)

      // Keep the order from likes
      const postsMap = {}
      ;(posts || []).forEach((p) => { postsMap[p.id] = p })
      likedPosts.value = postIds.map((id) => postsMap[id]).filter(Boolean)
    }
    tabLoading.value = false
  }

  if (tab === 'media' && mediaPosts.value.length === 0) {
    tabLoading.value = true
    const { data } = await supabase
      .from('posts_with_stats')
      .select('*')
      .eq('author_id', profileId)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
    mediaPosts.value = data || []
    tabLoading.value = false
  }
}

async function startDM() {
  if (!profileData.value || !auth.activeProfile) return
  const myId = auth.activeProfile.id
  const otherId = profileData.value.id
  const [user1, user2] = myId < otherId ? [myId, otherId] : [otherId, myId]

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .eq('is_group', false)
    .maybeSingle()

  let convId
  if (existing) {
    convId = existing.id
  } else {
    const { data: created } = await supabase
      .from('conversations')
      .insert({ user1_id: user1, user2_id: user2, is_group: false })
      .select('id')
      .single()
    convId = created.id
  }

  router.push(`/messages/${convId}`)
}

function goToPost(postId) {
  router.push(`/post/${postId}`)
}

function openAvatarViewer() {
  if (profileData.value?.avatar_url) {
    showAvatarViewer.value = true
  }
}

onMounted(loadProfile)
watch(() => route.params.username, loadProfile)
</script>

<style scoped>
.profile-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
}

/* ============ Top bar ============ */
.profile-top-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(21, 32, 43, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 52px;
  z-index: 5;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1.1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.back-btn:hover { background: var(--bg-hover); }

.top-bar-info {
  display: flex;
  flex-direction: column;
}
.top-bar-name { font-weight: 700; font-size: 0.95rem; line-height: 1.2; }
.top-bar-count { font-size: 0.75rem; color: var(--text-secondary); }

/* ============ Banner ============ */
.profile-banner {
  height: 180px;
  position: relative;
  overflow: hidden;
}

.banner-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a3a5c 0%, #0d1f33 40%, #1da1f2 100%);
  opacity: 0.6;
}

/* ============ Avatar row ============ */
.profile-avatar-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 1rem;
  margin-top: -60px;
  position: relative;
  z-index: 2;
}

.avatar-wrapper {
  border: 4px solid var(--bg-primary);
  border-radius: 50%;
  background: var(--bg-primary);
  line-height: 0;
  transition: transform 0.15s;
}

.avatar-wrapper.clickable {
  cursor: pointer;
}

.avatar-wrapper.clickable:hover {
  transform: scale(1.05);
}

.profile-actions {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
}

.action-dm-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.action-dm-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.edit-profile-btn {
  padding: 0.4rem 1rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.edit-profile-btn:hover {
  background: rgba(239, 243, 244, 0.1);
}

/* ============ Profile info ============ */
.profile-info {
  padding: 0.75rem 1rem 0;
}

.profile-names {
  margin-bottom: 0.5rem;
}

.display-name {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.username {
  display: block;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 0.1rem;
}

.admin-badge {
  background: var(--accent);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.hero-badge {
  background: linear-gradient(135deg, #FFD700, #FF6B00);
  color: #000;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.avatar-wrapper.hero-glow {
  border-radius: 50%;
  box-shadow: 0 0 20px var(--hero-primary, #FFD700), 0 0 40px color-mix(in srgb, var(--hero-primary, #FFD700) 30%, transparent);
}

.bio {
  font-size: 0.92rem;
  line-height: 1.45;
  margin: 0.5rem 0;
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.5rem 0;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.meta-icon {
  font-size: 0.9rem;
}

.profile-stats {
  display: flex;
  gap: 1.2rem;
  margin: 0.75rem 0 0;
  padding-bottom: 0.75rem;
}

.stat {
  font-size: 0.88rem;
  color: var(--text-secondary);
  cursor: default;
}
.stat strong {
  color: var(--text-primary);
  font-weight: 700;
}

/* ============ Balance stat ============ */
.stat-balance strong {
  color: var(--success);
}

/* ============ Character Card ============ */
.character-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 1rem 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.character-card:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.character-card-left {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  flex: 1;
}

.character-card-photo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.character-card-photo-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.character-card-identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.character-card-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-card-details {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.character-card-stats {
  flex-shrink: 0;
  margin-left: 0.5rem;
}

/* ============ Tabs ============ */
.profile-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.tab {
  flex: 1;
  padding: 0.85rem 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
.tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tab.active {
  color: var(--text-primary);
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 4px;
  background: var(--accent);
  border-radius: 2px;
}

/* ============ Tab content ============ */
.tab-content {
  min-height: 200px;
}

.empty {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

/* ============ Media grid ============ */
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}

.media-item {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.15s;
}

.media-item:hover img {
  opacity: 0.8;
}

/* ============ Avatar Lightbox ============ */
.avatar-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  z-index: 10000;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.lightbox-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.lightbox-content img {
  width: 300px;
  height: 300px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  animation: scaleIn 0.25s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.lightbox-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.lightbox-name {
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
}

.lightbox-handle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

/* ============ Responsive ============ */
@media (max-width: 600px) {
  .profile-banner { height: 130px; }
  .profile-avatar-row { margin-top: -45px; }
  .avatar-wrapper :deep(.user-avatar) { width: 90px !important; height: 90px !important; }
  .media-grid { grid-template-columns: repeat(2, 1fr); }

  .lightbox-content img {
    width: 240px;
    height: 240px;
  }
}
</style>
