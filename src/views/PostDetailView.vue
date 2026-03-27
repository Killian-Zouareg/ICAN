<template>
  <div class="post-detail">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else-if="post">
      <PostCard :post="post" @comment="() => {}" />
      <CommentForm @submit="handleAddComment" />
      <CommentList :comments="comments" @delete="handleDeleteComment" />
    </template>
    <div v-else class="empty">Post introuvable</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { usePostsStore } from '../stores/posts'
import PostCard from '../components/PostCard.vue'
import CommentList from '../components/CommentList.vue'
import CommentForm from '../components/CommentForm.vue'

const route = useRoute()
const postsStore = usePostsStore()

const post = ref(null)
const comments = ref([])
const loading = ref(true)

async function fetchPost() {
  const { data } = await supabase
    .from('posts_with_stats')
    .select('*')
    .eq('id', route.params.id)
    .single()
  post.value = data
}

async function fetchComments() {
  comments.value = await postsStore.fetchComments(route.params.id)
}

async function handleAddComment(content) {
  await postsStore.addComment(route.params.id, content)
  await fetchComments()
  if (post.value) post.value.comment_count++
}

async function handleDeleteComment(commentId) {
  await postsStore.deleteComment(commentId)
  comments.value = comments.value.filter((c) => c.id !== commentId)
  if (post.value) post.value.comment_count--
}

onMounted(async () => {
  await Promise.all([fetchPost(), fetchComments()])
  loading.value = false
})
</script>

<style scoped>
.post-detail {
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

.back-btn:hover {
  text-decoration: underline;
}
</style>
