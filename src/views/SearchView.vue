<template>
  <div class="search-page">
    <div class="search-header">
      <div class="search-input-wrap">
        <span class="search-icon">&#x1F50D;</span>
        <input
          ref="searchInput"
          v-model="query"
          class="search-input"
          type="text"
          placeholder="Rechercher des profils, posts, messages..."
          @input="onInput"
        />
        <button v-if="query" class="search-clear" @click="clearSearch">&times;</button>
      </div>
      <div class="search-tabs">
        <button class="search-tab" :class="{ active: tab === 'all' }" @click="tab = 'all'">Tout</button>
        <button class="search-tab" :class="{ active: tab === 'profiles' }" @click="tab = 'profiles'">
          Profils <span v-if="results.profiles.length" class="tab-count">{{ results.profiles.length }}</span>
        </button>
        <button class="search-tab" :class="{ active: tab === 'posts' }" @click="tab = 'posts'">
          Posts <span v-if="results.posts.length" class="tab-count">{{ results.posts.length }}</span>
        </button>
      </div>
    </div>

    <!-- Empty state: show inline trending -->
    <div v-if="!query.trim()" class="search-discover">
      <div class="search-empty">
        <span class="search-empty-icon">&#x1F50D;</span>
        <p>Recherchez des profils ou des posts</p>
      </div>

      <!-- Inline Trending -->
      <div class="inline-trending">
        <div class="inline-section">
          <h3 class="inline-section-title">&#x1F525; Tendances de la semaine</h3>
          <div v-if="trendingLoading" class="search-loading" style="padding: 1rem;">
            <div class="spinner"></div>
          </div>
          <div v-else-if="trends.length === 0" class="inline-empty">
            Utilisez des #hashtags dans vos posts pour lancer des tendances
          </div>
          <div v-else class="inline-trends-grid">
            <button
              v-for="(trend, i) in trends"
              :key="i"
              class="inline-trend-chip"
              @click="searchTrend(trend.word)"
            >
              <span class="inline-trend-word">{{ trend.word }}</span>
              <span class="inline-trend-count">{{ trend.count }}</span>
            </button>
          </div>
        </div>

        <div v-if="activeUsers.length > 0" class="inline-section">
          <h3 class="inline-section-title">&#x1F4C8; Utilisateurs actifs</h3>
          <router-link
            v-for="u in activeUsers"
            :key="u.id"
            :to="`/user/${u.username}`"
            class="inline-active-user"
          >
            <UserAvatar :url="u.avatar_url" :name="u.display_name" :size="36" />
            <div class="inline-user-info">
              <span class="inline-user-name">{{ u.display_name }}</span>
              <span class="inline-user-handle">@{{ u.username }}</span>
            </div>
            <span class="inline-user-posts">{{ u.post_count }} post{{ u.post_count > 1 ? 's' : '' }}</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="searching" class="search-loading">
      <div class="spinner"></div>
      Recherche en cours...
    </div>

    <!-- No results -->
    <div v-else-if="hasNoResults" class="search-empty">
      <span class="search-empty-icon">&#x1F614;</span>
      <p>Aucun r&eacute;sultat pour &laquo; {{ query }} &raquo;</p>
    </div>

    <!-- Results -->
    <div v-else class="search-results">
      <!-- Profiles -->
      <div v-if="(tab === 'all' || tab === 'profiles') && results.profiles.length > 0" class="result-section">
        <h3 v-if="tab === 'all'" class="result-section-title">Profils</h3>
        <router-link
          v-for="p in results.profiles"
          :key="p.id"
          :to="`/user/${p.username}`"
          class="result-profile"
        >
          <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="44" />
          <div class="result-profile-info">
            <span class="result-profile-name">
              {{ p.display_name }}
              <span v-if="p.is_hero" class="hero-tag">Hero</span>
              <span v-else-if="p.is_admin" class="admin-tag">Admin</span>
            </span>
            <span class="result-profile-handle">@{{ p.username }}</span>
          </div>
        </router-link>
      </div>

      <!-- Posts -->
      <div v-if="(tab === 'all' || tab === 'posts') && results.posts.length > 0" class="result-section">
        <h3 v-if="tab === 'all'" class="result-section-title">Posts</h3>
        <router-link
          v-for="p in results.posts"
          :key="p.id"
          :to="`/post/${p.id}`"
          class="result-post"
        >
          <div class="result-post-header">
            <UserAvatar :url="p.author?.avatar_url" :name="p.author?.display_name" :size="28" />
            <span class="result-post-author">{{ p.author?.display_name || 'Inconnu' }}</span>
            <span class="result-post-handle">@{{ p.author?.username }}</span>
            <span class="result-post-time">{{ timeAgo(p.created_at) }}</span>
          </div>
          <p class="result-post-content" v-html="highlightQuery(p.content)"></p>
          <div v-if="p.image_url" class="result-post-image">
            <img :src="p.image_url" alt="" />
          </div>
          <div class="result-post-stats">
            <span>&#x2764; {{ p.like_count || 0 }}</span>
            <span>&#x1F4AC; {{ p.comment_count || 0 }}</span>
            <span>&#x1F500; {{ p.repost_count || 0 }}</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import UserAvatar from '../components/UserAvatar.vue'
import { timeAgo } from '../lib/time'

const route = useRoute()
const searchInput = ref(null)
const query = ref('')
const tab = ref('all')
const searching = ref(false)
let debounceTimer = null

const results = ref({
  profiles: [],
  posts: [],
})

// ---- Inline trending data (for mobile & empty state) ----
const trendingLoading = ref(true)
const trends = ref([])
const activeUsers = ref([])

async function fetchInlineTrends() {
  trendingLoading.value = true
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('posts')
    .select('content, author_id')
    .gte('created_at', since)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!posts || posts.length === 0) {
    trends.value = []
    activeUsers.value = []
    trendingLoading.value = false
    return
  }

  // Extract #hashtags only
  const tagCount = {}
  const hashtagRe = /#([a-zA-Z\u00C0-\u024F0-9_]{2,})/g

  for (const post of posts) {
    if (!post.content) continue
    const found = new Set()
    let match
    while ((match = hashtagRe.exec(post.content)) !== null) {
      found.add('#' + match[1].toLowerCase())
    }
    for (const tag of found) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    }
  }

  trends.value = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ word: tag, count }))

  // Active users
  const authorCount = {}
  for (const p of posts) {
    authorCount[p.author_id] = (authorCount[p.author_id] || 0) + 1
  }
  const topIds = Object.entries(authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }))

  if (topIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', topIds.map(t => t.id))
    const profileMap = {}
    for (const p of (profiles || [])) profileMap[p.id] = p
    activeUsers.value = topIds
      .filter(t => profileMap[t.id])
      .map(t => ({ ...profileMap[t.id], post_count: t.count }))
  }

  trendingLoading.value = false
}

// ---- Search logic ----
const hasNoResults = computed(() =>
  query.value.trim() &&
  !searching.value &&
  results.value.profiles.length === 0 &&
  results.value.posts.length === 0
)

function onInput() {
  clearTimeout(debounceTimer)
  if (!query.value.trim()) {
    results.value = { profiles: [], posts: [] }
    return
  }
  debounceTimer = setTimeout(doSearch, 350)
}

function clearSearch() {
  query.value = ''
  results.value = { profiles: [], posts: [] }
  searchInput.value?.focus()
}

function searchTrend(word) {
  query.value = word
  doSearch()
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true

  const [profilesRes, postsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_admin, is_hero')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20),
    supabase
      .from('posts_with_stats')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_admin)')
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  results.value = {
    profiles: profilesRes.data || [],
    posts: postsRes.data || [],
  }

  searching.value = false
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlightQuery(text) {
  if (!text || !query.value.trim()) return escapeHtml(text || '')
  const safe = escapeHtml(text)
  const q = query.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escaped = escapeHtml(query.value.trim())
  return safe.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

// Watch route.query.q for changes (clicking trending links)
watch(() => route.query.q, (newQ) => {
  if (newQ && newQ !== query.value) {
    query.value = newQ
    doSearch()
  }
})

onMounted(() => {
  fetchInlineTrends()
  if (route.query.q) {
    query.value = route.query.q
    doSearch()
  } else {
    nextTick(() => searchInput.value?.focus())
  }
})
</script>

<style scoped src="./SearchView.css"></style>
