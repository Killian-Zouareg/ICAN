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

<style scoped>
.search-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
}

.search-header {
  position: sticky;
  top: 48px;
  background: var(--bg-primary);
  z-index: 5;
  border-bottom: 1px solid var(--border);
}

.search-input-wrap {
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  gap: 0.5rem;
}

.search-icon {
  font-size: 1rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.5rem 1rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 50%;
}

.search-clear:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.search-tabs {
  display: flex;
  border-bottom: none;
}

.search-tab {
  flex: 1;
  padding: 0.6rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.search-tab:hover {
  background: var(--bg-hover);
}

.search-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-count {
  background: var(--bg-hover);
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  font-size: 0.75rem;
}

.search-tab.active .tab-count {
  background: rgba(29, 161, 242, 0.15);
}

/* Empty / Loading */
.search-empty, .search-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  gap: 0.5rem;
}

.search-empty-icon {
  font-size: 2.5rem;
  opacity: 0.4;
}

.search-loading {
  flex-direction: row;
  gap: 0.75rem;
}

.spinner {
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

/* Results */
.result-section {
  border-bottom: 1px solid var(--border);
}

.result-section:last-child {
  border-bottom: none;
}

.result-section-title {
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--bg-secondary);
}

/* Profile results */
.result-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.result-profile:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.result-profile-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.result-profile-name {
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.admin-tag {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  text-transform: uppercase;
}

.hero-tag {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: linear-gradient(135deg, #FFD700, #FF6B00);
  color: #000;
  text-transform: uppercase;
}

.result-profile-handle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Post results */
.result-post {
  display: block;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.result-post:last-child {
  border-bottom: none;
}

.result-post:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.result-post-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.result-post-author {
  font-weight: 600;
  font-size: 0.85rem;
}

.result-post-handle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.result-post-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: auto;
}

.result-post-content {
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-post-content :deep(mark) {
  background: rgba(29, 161, 242, 0.25);
  color: var(--accent);
  border-radius: 2px;
  padding: 0 2px;
}

.result-post-image {
  margin-top: 0.5rem;
}

.result-post-image img {
  max-width: 100%;
  max-height: 150px;
  border-radius: 8px;
  object-fit: cover;
}

.result-post-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---- Inline trending (shown in empty state) ---- */
.search-discover {
  padding-bottom: var(--page-bottom-padding);
}

.inline-trending {
  padding: 0 1rem 1rem;
}

.inline-section {
  margin-bottom: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}

.inline-section-title {
  padding: 0.7rem 1rem;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
}

.inline-empty {
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
}

.inline-trends-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.inline-trend-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.inline-trend-chip:hover {
  border-color: var(--accent);
  background: rgba(29, 161, 242, 0.1);
  color: var(--accent);
}

.inline-trend-word {
  font-weight: 600;
}

.inline-trend-count {
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.1rem 0.35rem;
  border-radius: 8px;
}

.inline-active-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.inline-active-user:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.inline-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.inline-user-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.inline-user-handle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.inline-user-posts {
  font-size: 0.75rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}
</style>
