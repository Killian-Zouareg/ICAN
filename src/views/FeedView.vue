<template>
  <div class="feed">
    <div class="feed-header">
      <span class="feed-title">Accueil</span>
      <button class="refresh-btn" @click="postsStore.fetchFeed()" title="Rafra&icirc;chir">
        &#x21BB;
      </button>
    </div>

    <!-- Realtime: new posts banner -->
    <Transition name="new-posts">
      <button
        v-if="postsStore.newPostIds.length > 0"
        class="new-posts-banner"
        @click="postsStore.loadNewPosts()"
      >
        {{ postsStore.newPostIds.length }} nouveau{{ postsStore.newPostIds.length > 1 ? 'x' : '' }}
        post{{ postsStore.newPostIds.length > 1 ? 's' : '' }}
      </button>
    </Transition>

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
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useAuthStore } from '../stores/auth'
import { useRealtimeSubscription } from '../composables/useRealtimeSubscription'
import PostComposer from '../components/PostComposer.vue'
import PostCard from '../components/PostCard.vue'

const postsStore = usePostsStore()
const auth = useAuthStore()
const router = useRouter()

function goToPost(postId) {
  router.push(`/post/${postId}`)
}

// "Ting" sound generated via Web Audio API (no asset required).
let audioCtx = null
function playTing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1320, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.45)
  } catch { /* ignore */ }
}

const ORIGINAL_TITLE = document.title
function updateTitle(n) {
  document.title = n > 0 ? `(${n}) ${ORIGINAL_TITLE}` : ORIGINAL_TITLE
}

watch(
  () => postsStore.newPostIds.length,
  (n, prev) => {
    if (n > (prev || 0)) playTing()
    updateTitle(n)
  },
)

// Realtime subscription for new posts
const { subscribe } = useRealtimeSubscription('feed', [
  {
    event: 'INSERT',
    table: 'posts',
    callback: (payload) => {
      // Skip own posts (already in feed via optimistic update)
      if (payload.new.author_id === auth.activeProfile?.id) return
      postsStore.addPendingPost(payload.new.id)
    },
  },
  {
    event: 'DELETE',
    table: 'posts',
    callback: (payload) => {
      postsStore.posts = postsStore.posts.filter(p => p.id !== payload.old.id)
      postsStore.newPostIds = postsStore.newPostIds.filter(id => id !== payload.old.id)
    },
  },
])

onMounted(() => {
  postsStore.fetchFeed()
  subscribe()
})

onUnmounted(() => {
  document.title = ORIGINAL_TITLE
})
</script>

<style scoped>
.feed {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
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

/* New posts banner */
.new-posts-banner {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s;
  font-family: inherit;
}

.new-posts-banner:hover {
  background: var(--accent-hover);
}

.new-posts-enter-active,
.new-posts-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.new-posts-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.new-posts-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
