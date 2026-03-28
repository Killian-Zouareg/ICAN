<template>
  <div class="feed">
    <div class="feed-header">
      <span class="feed-title">Accueil</span>
      <button class="refresh-btn" @click="postsStore.fetchFeed()" title="Rafra&icirc;chir">
        &#x21BB;
      </button>
    </div>

    <PostComposer />

    <div v-if="postsStore.loading" class="loading">Chargement...</div>
    <div v-else-if="postsStore.posts.length === 0" class="empty">
      Aucun post pour le moment. Sois le premier !
    </div>
    <template v-else>
      <PostCard
        v-for="post in postsStore.posts"
        :key="post.id"
        :post="post"
        @comment="goToPost"
      />
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import PostComposer from '../components/PostComposer.vue'
import PostCard from '../components/PostCard.vue'

const postsStore = usePostsStore()
const router = useRouter()

function goToPost(postId) {
  router.push(`/post/${postId}`)
}

onMounted(() => {
  postsStore.fetchFeed()
})
</script>

<style scoped>
.feed {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  position: sticky;
  top: 52px;
  z-index: 5;
}

.feed-title {
  font-weight: 700;
  font-size: 1.1rem;
}

.refresh-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1.3rem;
  padding: 0.25rem 0.5rem;
  border-radius: 50%;
  transition: background 0.15s;
}

.refresh-btn:hover {
  background: var(--bg-hover);
}
</style>
