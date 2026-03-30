<template>
  <aside class="trending-panel">
    <!-- Search shortcut -->
    <router-link to="/search" class="trending-search">
      <span class="trending-search-icon">&#x1F50D;</span>
      <span class="trending-search-text">Rechercher</span>
    </router-link>

    <!-- Trending hashtags -->
    <div class="trending-section">
      <h3 class="trending-title">Tendances</h3>
      <div v-if="loading" class="trending-loading">
        <div class="spinner"></div>
      </div>
      <div v-else-if="trends.length === 0" class="trending-empty">
        Utilisez des #hashtags dans vos posts pour lancer des tendances
      </div>
      <div v-else class="trending-list">
        <router-link
          v-for="(trend, i) in trends"
          :key="i"
          :to="`/search?q=${encodeURIComponent(trend.tag)}`"
          class="trending-item"
        >
          <span class="trending-rank">{{ i + 1 }}</span>
          <div class="trending-info">
            <span class="trending-word">{{ trend.tag }}</span>
            <span class="trending-count">{{ trend.count }} post{{ trend.count > 1 ? 's' : '' }}</span>
          </div>
        </router-link>
      </div>
    </div>

    <!-- Active users -->
    <div class="trending-section">
      <h3 class="trending-title">Utilisateurs actifs</h3>
      <router-link
        v-for="u in activeUsers"
        :key="u.id"
        :to="`/user/${u.username}`"
        class="active-user"
      >
        <UserAvatar :url="u.avatar_url" :name="u.display_name" :size="32" />
        <div class="active-user-info">
          <span class="active-user-name">{{ u.display_name }}</span>
          <span class="active-user-handle">@{{ u.username }}</span>
        </div>
        <span class="active-user-posts">{{ u.post_count }} posts</span>
      </router-link>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

const loading = ref(true)
const trends = ref([])
const activeUsers = ref([])

async function fetchTrends() {
  loading.value = true

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('posts')
    .select('content')
    .gte('created_at', since)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!posts || posts.length === 0) {
    trends.value = []
    loading.value = false
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
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }))

  loading.value = false
}

async function fetchActiveUsers() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('posts')
    .select('author_id')
    .gte('created_at', since)
    .limit(500)

  if (!posts || posts.length === 0) {
    activeUsers.value = []
    return
  }

  const authorCount = {}
  for (const p of posts) {
    authorCount[p.author_id] = (authorCount[p.author_id] || 0) + 1
  }

  const topIds = Object.entries(authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }))

  if (topIds.length === 0) {
    activeUsers.value = []
    return
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', topIds.map(t => t.id))

  if (!profiles) {
    activeUsers.value = []
    return
  }

  const profileMap = {}
  for (const p of profiles) profileMap[p.id] = p

  activeUsers.value = topIds
    .filter(t => profileMap[t.id])
    .map(t => ({
      ...profileMap[t.id],
      post_count: t.count,
    }))
}

onMounted(() => {
  fetchTrends()
  fetchActiveUsers()
})
</script>

<style scoped>
.trending-panel {
  width: 280px;
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Search shortcut */
.trending-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.15s;
  flex-shrink: 0;
}

.trending-search:hover {
  border-color: var(--accent);
  color: var(--accent);
  text-decoration: none;
}

.trending-search-icon {
  font-size: 0.85rem;
}

/* Sections */
.trending-section {
  background: var(--bg-secondary);
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
}

.trending-title {
  padding: 0.75rem 1rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  z-index: 1;
}

.trending-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
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

.trending-empty {
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Scrollable trending list */
.trending-list {
  max-height: 320px;
  overflow-y: auto;
}

.trending-list::-webkit-scrollbar {
  width: 4px;
}

.trending-list::-webkit-scrollbar-track {
  background: transparent;
}

.trending-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

/* Trend items */
.trending-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.trending-item:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.trending-rank {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.trending-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.trending-word {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trending-count {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

/* Active users */
.active-user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.active-user:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.active-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.active-user-name {
  font-weight: 600;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-user-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.active-user-posts {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* Hide on mobile and small screens */
@media (max-width: 1100px) {
  .trending-panel {
    display: none;
  }
}
</style>
