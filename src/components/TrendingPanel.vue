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

<style scoped src="./TrendingPanel.css"></style>
