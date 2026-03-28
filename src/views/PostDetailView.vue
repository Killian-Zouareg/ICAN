<template>
  <div class="post-detail">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else-if="post">
      <PostCard :post="post" @comment="() => {}" />

      <div class="comments-section">
        <div class="comments-header">
          <span class="comments-title">Commentaires</span>
          <span v-if="comments.length > 0" class="comments-count">{{ comments.length }}</span>
        </div>

        <CommentForm
          :replying-to="replyingTo"
          @submit="handleAddComment"
          @cancel-reply="replyingTo = null"
        />

        <CommentList
          :comments="comments"
          :comment-likes="commentLikes"
          @reply="handleReply"
          @toggle-like="handleToggleCommentLike"
          @delete="handleDeleteComment"
        />
      </div>
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
const commentLikes = ref(new Set())
const loading = ref(true)
const replyingTo = ref(null)

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
  // Fetch which comments the user has liked
  const commentIds = comments.value.map((c) => c.id)
  commentLikes.value = await postsStore.fetchCommentLikes(commentIds)
}

function handleReply(comment) {
  replyingTo.value = comment
}

async function handleAddComment(content) {
  const parentId = replyingTo.value ? replyingTo.value.id : null
  await postsStore.addComment(route.params.id, content, parentId)
  replyingTo.value = null
  await fetchComments()
  if (post.value) post.value.comment_count++
}

async function handleToggleCommentLike(commentId) {
  const liked = await postsStore.toggleCommentLike(commentId)
  // Update local state
  if (liked) {
    commentLikes.value.add(commentId)
  } else {
    commentLikes.value.delete(commentId)
  }
  // Update like count locally
  const comment = comments.value.find((c) => c.id === commentId)
  if (comment) {
    comment.like_count = (comment.like_count || 0) + (liked ? 1 : -1)
  }
  // Force reactivity
  commentLikes.value = new Set(commentLikes.value)
}

async function handleDeleteComment(commentId) {
  await postsStore.deleteComment(commentId)
  // Also remove any replies to this comment
  const toRemove = new Set([commentId])
  let changed = true
  while (changed) {
    changed = false
    comments.value.forEach((c) => {
      if (c.parent_id && toRemove.has(c.parent_id) && !toRemove.has(c.id)) {
        toRemove.add(c.id)
        changed = true
      }
    })
  }
  const removedCount = comments.value.filter((c) => toRemove.has(c.id)).length
  comments.value = comments.value.filter((c) => !toRemove.has(c.id))
  if (post.value) post.value.comment_count -= removedCount
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

.comments-section {
  margin-top: 0;
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.comments-title {
  font-weight: 700;
  font-size: 1rem;
}

.comments-count {
  background: var(--accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
}
</style>
