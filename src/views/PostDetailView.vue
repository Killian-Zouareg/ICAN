<template>
  <div class="post-detail">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else-if="post">
      <PostCard :post="post" @comment="() => {}" />

      <!-- Liked by section -->
      <div class="likes-section" v-if="post.like_count > 0 || (post._original && post._original.like_count > 0)">
        <button class="likes-toggle" @click="toggleLikesList">
          <span class="likes-icon">&#x2764;</span>
          <span class="likes-label">
            {{ likeCountDisplay }} J'aime
          </span>
          <span class="likes-chevron" :class="{ open: showLikes }">&#x25B6;</span>
        </button>

        <div v-if="showLikes" class="likes-list">
          <div v-if="loadingLikes" class="loading-small">Chargement...</div>
          <div v-else-if="likedByUsers.length === 0" class="empty-small">Aucun like</div>
          <router-link
            v-for="u in likedByUsers"
            :key="u.isGhost ? `ghost-${u.ghost_id}` : u.id"
            :to="u.isGhost ? `/ghost/${u.ghost_id}` : `/user/${u.username}`"
            class="liked-user"
          >
            <UserAvatar :url="u.avatar_url" :name="u.display_name || u.username || '?'" :size="32" />
            <div class="liked-user-info">
              <span class="liked-user-name">{{ u.display_name }}</span>
              <span class="liked-user-handle">@{{ u.username }}</span>
            </div>
          </router-link>
        </div>
      </div>

      <div class="comments-section">
        <div class="comments-header">
          <span class="comments-title">Commentaires</span>
          <span v-if="comments.length + ghostComments.length > 0" class="comments-count">{{ comments.length + ghostComments.length }}</span>
        </div>

        <CommentForm
          :replying-to="replyingTo"
          @submit="handleAddComment"
          @cancel-reply="replyingTo = null"
        />

        <CommentList
          :comments="comments"
          :ghost-comments="ghostComments"
          :comment-likes="commentLikes"
          @reply="handleReply"
          @toggle-like="handleToggleCommentLike"
          @delete="handleDeleteComment"
          @quote="handleQuoteComment"
        />
      </div>
    </template>
    <div v-else class="empty">Post introuvable</div>

    <QuoteComposer
      v-if="quotingComment"
      :quoted-comment="quotingComment"
      @close="quotingComment = null"
      @published="quotingComment = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { usePostsStore } from '../stores/posts'
import { useGhostEngagementStore } from '../stores/ghostEngagement'
import PostCard from '../components/PostCard.vue'
import CommentList from '../components/CommentList.vue'
import CommentForm from '../components/CommentForm.vue'
import UserAvatar from '../components/UserAvatar.vue'
import QuoteComposer from '../components/QuoteComposer.vue'

const route = useRoute()
const postsStore = usePostsStore()
const ghostStore = useGhostEngagementStore()

const post = ref(null)
const comments = ref([])
const ghostComments = ref([])
const commentLikes = ref(new Set())
const loading = ref(true)
const replyingTo = ref(null)
const quotingComment = ref(null)

// Likes list
const showLikes = ref(false)
const loadingLikes = ref(false)
const likedByUsers = ref([])

const likeCountDisplay = computed(() => {
  if (!post.value) return 0
  if (post.value._original) return post.value._original.like_count || 0
  return post.value.like_count || 0
})

const targetPostId = computed(() => {
  if (!post.value) return null
  if (post.value._original) return post.value._original.id
  return post.value.id
})

async function toggleLikesList() {
  showLikes.value = !showLikes.value
  if (showLikes.value && likedByUsers.value.length === 0) {
    await fetchLikedBy()
  }
}

async function fetchLikedBy() {
  if (!targetPostId.value) return
  loadingLikes.value = true
  try {
    const { data } = await supabase
      .from('likes')
      .select('*, profiles(id, username, display_name, avatar_url)')
      .eq('post_id', targetPostId.value)
      .order('created_at', { ascending: false })
    const realLikes = (data || []).map((l) => l.profiles)
    const ghostLikes = await ghostStore.fetchGhostLikes(targetPostId.value)
    likedByUsers.value = [...realLikes, ...ghostLikes]
  } finally {
    loadingLikes.value = false
  }
}

async function fetchPost() {
  const { data } = await supabase
    .from('posts_with_stats')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (data) {
    // Enrich with admin status
    const authorIds = [data.author_id]
    if (data.repost_of) {
      const { data: original } = await supabase
        .from('posts_with_stats')
        .select('*')
        .eq('id', data.repost_of)
        .single()
      if (original) {
        data._original = original
        authorIds.push(original.author_id)
      }
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .in('id', [...new Set(authorIds)])
    const adminMap = {}
    ;(profiles || []).forEach((p) => { adminMap[p.id] = p.is_admin === true })
    data.is_admin = adminMap[data.author_id] || false
    if (data._original) data._original.is_admin = adminMap[data._original.author_id] || false
  }

  post.value = data
}

async function fetchComments() {
  comments.value = await postsStore.fetchComments(route.params.id)
  const commentIds = comments.value.map((c) => c.id)
  commentLikes.value = await postsStore.fetchCommentLikes(commentIds)
  ghostComments.value = await ghostStore.fetchGhostComments(route.params.id)
}

function handleReply(comment) {
  replyingTo.value = comment
}

function handleQuoteComment(comment) {
  quotingComment.value = comment
}

async function handleAddComment(content, imageFile) {
  try {
    const parentId = replyingTo.value ? replyingTo.value.id : null
    await postsStore.addComment(route.params.id, content, parentId, imageFile)
    replyingTo.value = null
    await fetchComments()
    if (post.value) post.value.comment_count++
  } catch (e) {
    alert(e.message || 'Erreur lors de l\'envoi du commentaire')
  }
}

async function handleToggleCommentLike(commentId) {
  const liked = await postsStore.toggleCommentLike(commentId)
  if (liked) {
    commentLikes.value.add(commentId)
  } else {
    commentLikes.value.delete(commentId)
  }
  const comment = comments.value.find((c) => c.id === commentId)
  if (comment) {
    comment.like_count = (comment.like_count || 0) + (liked ? 1 : -1)
  }
  commentLikes.value = new Set(commentLikes.value)
}

async function handleDeleteComment(commentId) {
  await postsStore.deleteComment(commentId)
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
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
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

/* Likes section */
.likes-section {
  border-top: 1px solid var(--border);
}

.likes-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  text-align: left;
}

.likes-toggle:hover {
  background: var(--bg-hover);
}

.likes-icon {
  color: var(--danger);
  font-size: 1rem;
}

.likes-label {
  font-weight: 600;
}

.likes-chevron {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.likes-chevron.open {
  transform: rotate(90deg);
}

.likes-list {
  border-bottom: 1px solid var(--border);
}

.loading-small,
.empty-small {
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.liked-user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  text-decoration: none;
  transition: background 0.15s;
}

.liked-user:hover {
  background: var(--bg-hover);
}

.liked-user-info {
  display: flex;
  flex-direction: column;
}

.liked-user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.88rem;
}

.liked-user-handle {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

/* Comments section */
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
