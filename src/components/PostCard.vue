<template>
  <div class="post-card" :class="{ 'admin-post': displayPost.is_admin }" @click="goToPost">
    <!-- Repost badge -->
    <div v-if="isRepost" class="repost-badge">
      <span class="repost-icon">
        <!-- Modern repost SVG -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      </span>
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
            :class="{ 'admin-name': displayPost.is_admin }"
            @click.stop
          >
            {{ displayPost.display_name }}
            <svg v-if="displayPost.is_admin" class="verified-badge" viewBox="0 0 22 22" aria-label="Compte certifié">
              <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.274-.586-.705-1.084-1.246-1.439-.54-.354-1.17-.551-1.816-.569-.646.018-1.275.215-1.816.57-.54.354-.972.852-1.246 1.438-.607-.223-1.264-.27-1.897-.14-.634.131-1.218.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.439 1.246-.354.54-.551 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.438.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="currentColor"/>
            </svg>
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
            @mousedown="animateClick($event)"
          >
            <span class="icon">
              <!-- Modern comment SVG -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span v-if="displayPost.comment_count > 0">{{ displayPost.comment_count }}</span>
          </button>

          <button
            class="action-btn repost-btn"
            :class="{ active: postsStore.hasReposted(originalPostId) }"
            @click.stop="handleRepost"
            @mousedown="animateClick($event)"
          >
            <span class="icon">
              <!-- Modern repost SVG -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            </span>
            <span v-if="displayPost.repost_count > 0">{{ displayPost.repost_count }}</span>
          </button>

          <button
            class="action-btn like-btn"
            :class="{ active: postsStore.hasLiked(originalPostId) }"
            @click.stop="handleLike"
            @mousedown="animateClick($event)"
          >
            <span class="icon">
              <!-- Modern like SVG (filled if liked) - viewBox 0 0 24 24, dimensions 16x16, path centré -->
              <svg v-if="postsStore.hasLiked(originalPostId)" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M12 21s-5.05-4.36-7.07-7.07C2.4 11.13 2 9.6 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 1.01 4.5 2.09C13.09 4.01 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.1-.4 2.63-2.93 5.43C17.05 16.64 12 21 12 21z"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M12 21s-5.05-4.36-7.07-7.07C2.4 11.13 2 9.6 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 1.01 4.5 2.09C13.09 4.01 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.1-.4 2.63-2.93 5.43C17.05 16.64 12 21 12 21z"/>
              </svg>
            </span>
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

// Animation de clic sur les boutons d'action
function animateClick(event) {
  const btn = event.currentTarget
  btn.classList.remove('clicked')
  // Force reflow to restart animation
  void btn.offsetWidth
  btn.classList.add('clicked')
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

/* Admin post highlight */
.post-card.admin-post {
  border-left: 3px solid var(--accent);
  background: rgba(29, 161, 242, 0.04);
}

.post-card.admin-post:hover {
  background: rgba(29, 161, 242, 0.08);
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
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.author-name:hover {
  text-decoration: underline;
}

.author-name.admin-name {
  color: var(--accent);
}

.verified-badge {
  width: 18px;
  height: 18px;
  color: var(--accent);
  flex-shrink: 0;
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


/* Animation scale sur clic (pas de hover) */
.action-btn.clicked {
  animation: btn-pop 0.18s cubic-bezier(.4,2,.6,1) 1;
}

@keyframes btn-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
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
  display: flex;
  align-items: center;
}

</style>
