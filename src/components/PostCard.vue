<template>
  <div class="post-card" @click="goToPost">
    <!-- Repost badge -->
    <div v-if="isRepost" class="repost-badge">
      <span class="repost-icon">&#x21BB;</span>
      <router-link
        :to="`/user/${post.username}`"
        class="repost-author"
        @click.stop
      >
        {{ post.display_name }}
      </router-link>
      a repost&eacute;
    </div>

    <div class="post-body">
      <router-link :to="`/user/${displayPost.username}`" @click.stop>
        <UserAvatar
          :url="displayPost.avatar_url"
          :name="displayPost.display_name || displayPost.username || '?'"
          :size="40"
        />
      </router-link>
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
          <span class="dot">&middot;</span>
          <span class="timestamp">{{ timeAgo(displayPost.created_at) }}</span>
        </div>

        <p v-if="displayPost.content" class="post-text">{{ displayPost.content }}</p>

        <div v-if="displayPost.image_url" class="post-image-wrapper" @click.stop>
          <img
            :src="displayPost.image_url"
            alt="Image du post"
            class="post-image"
            @click="openImage"
          />
        </div>

        <div class="actions">
          <button
            class="action-btn comment-btn"
            @click.stop="$emit('comment', originalPostId)"
          >
            <span class="icon">&#x1F4AC;</span>
            <span v-if="displayPost.comment_count > 0">{{ displayPost.comment_count }}</span>
          </button>

          <button
            class="action-btn repost-btn"
            :class="{ active: postsStore.hasReposted(originalPostId) }"
            @click.stop="handleRepost"
          >
            <span class="icon">&#x21BB;</span>
            <span v-if="displayPost.repost_count > 0">{{ displayPost.repost_count }}</span>
          </button>

          <button
            class="action-btn like-btn"
            :class="{ active: postsStore.hasLiked(originalPostId) }"
            @click.stop="handleLike"
          >
            <span class="icon">{{ postsStore.hasLiked(originalPostId) ? '&#x2764;' : '&#x2661;' }}</span>
            <span v-if="displayPost.like_count > 0">{{ displayPost.like_count }}</span>
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
})

defineEmits(['comment'])

const auth = useAuthStore()
const postsStore = usePostsStore()
const router = useRouter()

const isRepost = computed(() => !!props.post.repost_of)

// For reposts, show the original post content. For normal posts, show the post itself.
const displayPost = computed(() => {
  if (isRepost.value && props.post._original) {
    return props.post._original
  }
  return props.post
})

// The actual post ID to interact with (like, comment, repost)
const originalPostId = computed(() => displayPost.value.id)

const canDelete = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.post.author_id) || auth.isAdmin
})

function goToPost() {
  router.push(`/post/${originalPostId.value}`)
}

async function handleLike() {
  await postsStore.toggleLike(originalPostId.value)
}

async function handleRepost() {
  // Don't allow reposting your own post
  const myProfileIds = auth.profiles.map((p) => p.id)
  if (myProfileIds.includes(displayPost.value.author_id)) return
  await postsStore.toggleRepost(originalPostId.value)
}

function openImage() {
  window.open(displayPost.value.image_url, '_blank')
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
  color: var(--text-secondary);
  padding-left: 3.5rem;
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.repost-icon {
  color: var(--repost);
  font-size: 0.95rem;
}

.repost-author {
  color: var(--text-secondary);
  font-weight: 600;
  text-decoration: none;
}

.repost-author:hover {
  text-decoration: underline;
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

.post-image-wrapper {
  margin: 0.4rem 0 0.5rem;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 400px;
}

.post-image {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  display: block;
  cursor: pointer;
  transition: opacity 0.15s;
}

.post-image:hover {
  opacity: 0.9;
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
