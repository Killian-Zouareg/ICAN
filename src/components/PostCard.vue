<template>
  <div class="post-card" @click="goToPost">
    <!-- Repost badge -->
    <div v-if="post.repost_of" class="repost-badge">
      <span class="repost-icon">&#x21BB;</span>
      {{ post.display_name }} a reposté
    </div>

    <div class="post-body">
      <UserAvatar :url="displayPost.avatar_url" :name="displayPost.display_name || displayPost.username || '?'" :size="40" />
      <div class="post-content">
        <div class="post-header">
          <router-link
            :to="`/user/${displayPost.username}`"
            class="author-name"
            @click.stop
          >
            {{ displayPost.display_name }}
          </router-link>
          <span class="author-handle">@{{ displayPost.username }}</span>
          <span class="dot">·</span>
          <span class="timestamp">{{ timeAgo(post.created_at) }}</span>
        </div>

        <p class="post-text">{{ displayPost.content }}</p>

        <div class="actions">
          <button
            class="action-btn comment-btn"
            @click.stop="$emit('comment', post.id)"
          >
            <span class="icon">&#x1F4AC;</span>
            <span v-if="post.comment_count > 0">{{ post.comment_count }}</span>
          </button>

          <button
            class="action-btn repost-btn"
            :class="{ active: post.user_reposted }"
            @click.stop="handleRepost"
          >
            <span class="icon">&#x21BB;</span>
            <span v-if="post.repost_count > 0">{{ post.repost_count }}</span>
          </button>

          <button
            class="action-btn like-btn"
            :class="{ active: postsStore.hasLiked(post.id) }"
            @click.stop="handleLike"
          >
            <span class="icon">{{ postsStore.hasLiked(post.id) ? '&#x2764;' : '&#x2661;' }}</span>
            <span v-if="post.like_count > 0">{{ post.like_count }}</span>
          </button>

          <button
            v-if="canDelete"
            class="action-btn delete-btn"
            @click.stop="handleDelete"
          >
            <span class="icon">&#x1F5D1;</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  post: { type: Object, required: true },
  originalPost: { type: Object, default: null },
})

defineEmits(['comment'])

const auth = useAuthStore()
const postsStore = usePostsStore()
const router = useRouter()

const displayPost = computed(() => props.originalPost || props.post)

const canDelete = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.post.author_id) || auth.isAdmin
})

function goToPost() {
  router.push(`/post/${displayPost.value.id}`)
}

async function handleLike() {
  await postsStore.toggleLike(props.post.id)
}

async function handleRepost() {
  await postsStore.repost(displayPost.value.id)
}

async function handleDelete() {
  if (confirm('Supprimer ce post ?')) {
    await postsStore.deletePost(props.post.id)
  }
}
</script>

<style scoped>
.post-card {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.post-card:hover {
  background: var(--bg-hover);
}

.repost-badge {
  font-size: 0.8rem;
  color: var(--repost);
  padding-left: 3.5rem;
  margin-bottom: 0.25rem;
}

.repost-icon {
  margin-right: 0.25rem;
}

.post-body {
  display: flex;
  gap: 0.75rem;
}

.post-content {
  flex: 1;
  min-width: 0;
}

.post-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.author-name {
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.author-name:hover {
  text-decoration: underline;
}

.author-handle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.dot {
  color: var(--text-secondary);
}

.timestamp {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.post-text {
  margin: 0.3rem 0 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 1.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem;
}

.action-btn:hover {
  color: var(--accent);
}

.like-btn.active {
  color: var(--danger);
}

.repost-btn.active {
  color: var(--repost);
}

.delete-btn:hover {
  color: var(--danger);
}

.icon {
  font-size: 1.1rem;
}
</style>
