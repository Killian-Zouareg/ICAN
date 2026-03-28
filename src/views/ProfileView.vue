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
        <div class="banner-gradient"></div>
      </div>
      <div class="profile-avatar-row">
        <div class="avatar-wrapper">
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
            <span v-if="profileData.is_admin" class="admin-badge">Admin</span>
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

const stats = ref({ posts: 0, likes: 0 })

const isOwnProfile = computed(() => {
  if (!profileData.value) return false
  return auth.profiles.some((p) => p.id === profileData.value.id)
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

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', route.params.username)
    .single()
  profileData.value = data

  if (data) {
    await postsStore.fetchUserPosts(data.id)
    await fetchStats(data.id)
  }
  loading.value = false
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

onMounted(loadProfile)
watch(() => route.params.username, loadProfile)
</script>

<style scoped>
.profile-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
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

/* ============ Responsive ============ */
@media (max-width: 600px) {
  .profile-banner { height: 130px; }
  .profile-avatar-row { margin-top: -45px; }
  .avatar-wrapper :deep(.user-avatar) { width: 90px !important; height: 90px !important; }
  .media-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
