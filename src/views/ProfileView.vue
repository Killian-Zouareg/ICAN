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
  charisme: characterSheet.value?.charisme || 0,
  intelligence: characterSheet.value?.intelligence || 0,
  force: characterSheet.value?.force || 0,
  vigueur: characterSheet.value?.vigueur || 0,
  mobilite: characterSheet.value?.mobilite || 0,
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

<style scoped src="./ProfileView.css"></style>
