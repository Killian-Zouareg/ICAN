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
import { useAuthStore } from '../stores/auth'
import { useGhostEngagementStore } from '../stores/ghostEngagement'
import { useRealtimeSubscription } from '../composables/useRealtimeSubscription'
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
    if (data.quote_of) {
      const { data: quoted } = await supabase
        .from('posts_with_stats')
        .select('*')
        .eq('id', data.quote_of)
        .single()
      if (quoted) {
        data._quoted = quoted
        authorIds.push(quoted.author_id)
      }
    }
    if (data.quote_comment_id) {
      const { data: quotedComment } = await supabase
        .from('comments')
        .select('*, profiles(username, display_name, avatar_url)')
        .eq('id', data.quote_comment_id)
        .single()
      if (quotedComment) {
        data._quoted_comment = quotedComment
      }
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, is_admin, is_hero, hero_color_primary, hero_color_secondary')
      .in('id', [...new Set(authorIds)])
    const authorMap = {}
    ;(profiles || []).forEach((p) => { authorMap[p.id] = p })
    data.is_admin = authorMap[data.author_id]?.is_admin || false
    data.is_hero = authorMap[data.author_id]?.is_hero || false
    data.hero_color_primary = authorMap[data.author_id]?.hero_color_primary || null
    data.hero_color_secondary = authorMap[data.author_id]?.hero_color_secondary || null
    if (data._original) {
      data._original.is_admin = authorMap[data._original.author_id]?.is_admin || false
      data._original.is_hero = authorMap[data._original.author_id]?.is_hero || false
      data._original.hero_color_primary = authorMap[data._original.author_id]?.hero_color_primary || null
      data._original.hero_color_secondary = authorMap[data._original.author_id]?.hero_color_secondary || null
    }
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

// Realtime: live comments from other users
const auth = useAuthStore()
const { subscribe: subscribeComments } = useRealtimeSubscription('comments-' + route.params.id, [
  {
    event: 'INSERT',
    table: 'comments',
    filter: `post_id=eq.${route.params.id}`,
    callback: (payload) => {
      if (payload.new.author_id === auth.activeProfile?.id) return
      fetchComments()
    },
  },
])

onMounted(async () => {
  await Promise.all([fetchPost(), fetchComments()])
  loading.value = false
  subscribeComments()
})
</script>

<style scoped src="./PostDetailView.css"></style>
