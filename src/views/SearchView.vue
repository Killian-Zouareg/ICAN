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

    <!-- Empty state -->
    <div v-if="!query.trim()" class="search-empty">
      <span class="search-empty-icon">&#x1F50D;</span>
      <p>Recherchez des profils ou des posts</p>
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
              <span v-if="p.is_admin" class="admin-tag">Admin</span>
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
import { ref, computed, onMounted, nextTick } from 'vue'
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

async function doSearch() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true

  const [profilesRes, postsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_admin')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(20),
    supabase
      .from('posts_with_stats')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
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

function highlightQuery(text) {
  if (!text || !query.value.trim()) return text || ''
  const q = query.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

onMounted(() => {
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
</style>
