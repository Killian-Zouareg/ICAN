<template>
  <div class="profile-page">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else-if="profileData">
      <div class="profile-header">
        <div class="profile-avatar">
          {{ profileData.display_name.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-info">
          <h2 class="profile-name">{{ profileData.display_name }}</h2>
          <span class="profile-handle">@{{ profileData.username }}</span>
          <span v-if="profileData.is_admin" class="admin-badge">Admin</span>
        </div>
        <button
          v-if="!isOwnProfile"
          class="dm-btn"
          @click="startDM"
        >
          Envoyer un message
        </button>
      </div>

      <div class="posts-section">
        <h3 class="section-title">Posts</h3>
        <div v-if="postsStore.posts.length === 0" class="empty">Aucun post</div>
        <PostCard
          v-for="post in postsStore.posts"
          :key="post.id"
          :post="post"
          @comment="goToPost"
        />
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
import { useMessagesStore } from '../stores/messages'
import PostCard from '../components/PostCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const postsStore = usePostsStore()
const messagesStore = useMessagesStore()

const profileData = ref(null)
const loading = ref(true)

const isOwnProfile = computed(() => profileData.value?.id === auth.user?.id)

async function loadProfile() {
  loading.value = true
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', route.params.username)
    .single()
  profileData.value = data

  if (data) {
    await postsStore.fetchUserPosts(data.id)
  }
  loading.value = false
}

async function startDM() {
  if (!profileData.value) return
  const convId = await messagesStore.getOrCreateConversation(profileData.value.id)
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

.back-bar {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
}

.profile-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.8rem;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
}

.profile-name {
  margin: 0;
  font-size: 1.3rem;
}

.profile-handle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.admin-badge {
  display: inline-block;
  margin-left: 0.5rem;
  background: var(--accent);
  color: white;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  vertical-align: middle;
}

.dm-btn {
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 0.4rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
}

.dm-btn:hover {
  background: var(--accent);
  color: white;
}

.section-title {
  padding: 0.75rem 1rem;
  margin: 0;
  font-size: 1rem;
  border-bottom: 1px solid var(--border);
}

.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
