<template>
  <div class="feed">
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

    <button class="refresh-btn" @click="postsStore.fetchFeed()">
      Rafraîchir
    </button>
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

.refresh-btn {
  display: block;
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: none;
  border-top: 1px solid var(--border);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
}

.refresh-btn:hover {
  background: var(--bg-hover);
}
</style>
