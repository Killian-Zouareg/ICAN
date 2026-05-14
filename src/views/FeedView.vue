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

    <PostComposer :prefill="composerPrefill" />

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
      <div
        v-if="postsStore.hasMorePosts"
        ref="loadOlderSentinel"
        class="load-older-banner"
        :class="{ 'is-loading': postsStore.loadingOlder }"
        @click="postsStore.loadOlderPosts()"
      >
        <span v-if="postsStore.loadingOlder">Chargement...</span>
        <span v-else>Charger les posts plus anciens</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useAuthStore } from '../stores/auth'
import { useRealtimeSubscription } from '../composables/useRealtimeSubscription'
import PostComposer from '../components/PostComposer.vue'
import PostCard from '../components/PostCard.vue'

const postsStore = usePostsStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// Pre-fill for the composer when redirected from the map ("Poster d'ici")
const composerPrefill = ref('')
function consumeComposerPrefillFromRoute() {
  const { postLat, postLng, postLabel } = route.query
  if (!postLabel) return
  const lat = Number(postLat)
  const lng = Number(postLng)
  const coordStr = Number.isFinite(lat) && Number.isFinite(lng)
    ? ` (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    : ''
  composerPrefill.value = `\u{1F4CD} ${postLabel}${coordStr}`
  // Clear the query so refreshing doesn't re-trigger the prefill
  router.replace({ path: route.path, query: {} })
}
consumeComposerPrefillFromRoute()
watch(() => route.query, consumeComposerPrefillFromRoute)

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

// Auto-load older posts via IntersectionObserver on a sentinel at the bottom
const loadOlderSentinel = ref(null)
let observer = null

function setupObserver() {
  if (observer) observer.disconnect()
  if (!loadOlderSentinel.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        postsStore.loadOlderPosts()
      }
    },
    { rootMargin: '400px 0px' },
  )
  observer.observe(loadOlderSentinel.value)
}

watch(
  () => [postsStore.hasMorePosts, postsStore.posts.length],
  async () => {
    await nextTick()
    setupObserver()
  },
)

onMounted(() => {
  postsStore.fetchFeed()
  subscribe()
})

onUnmounted(() => {
  document.title = ORIGINAL_TITLE
  if (observer) observer.disconnect()
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
  top: calc(var(--header-height) + var(--safe-top));
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

/* Load older posts banner */
.load-older-banner {
  text-align: center;
  padding: 12px 16px;
  margin: 8px 12px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: background 0.15s ease;
  user-select: none;
}

.load-older-banner:hover {
  background: var(--bg-hover);
}

.load-older-banner.is-loading {
  cursor: default;
  color: var(--text-secondary);
}
</style>
