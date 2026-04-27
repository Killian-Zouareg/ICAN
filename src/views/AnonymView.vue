<template>
  <div class="anonym-page">
    <div class="anonym-header">
      <div class="anonym-title-block">
        <h1 class="anonym-title">
          <span class="mask-icon">&#x1F576;</span>
          iAnonym
        </h1>
        <p class="anonym-sub">Mur de confessions anonymes &mdash; personne ne sait qui a &eacute;crit quoi.</p>
      </div>
      <button class="anonym-compose-btn" @click="showComposer = true">
        <span>+</span> Nouveau post
      </button>
    </div>

    <!-- Composer modal -->
    <Transition name="fade">
      <div v-if="showComposer" class="anonym-modal-backdrop" @click.self="closeComposer">
        <div class="anonym-modal">
          <div class="anonym-modal-header">
            <span>&#x1F576; Post anonyme</span>
            <button class="anonym-modal-close" @click="closeComposer">&times;</button>
          </div>
          <textarea
            v-model="draft"
            class="anonym-textarea"
            placeholder="Confesse, balance, ou raconte... Tu es totalement anonyme."
            maxlength="280"
            rows="5"
            @keydown.ctrl.enter="submit"
            @keydown.meta.enter="submit"
          ></textarea>
          <div class="anonym-modal-footer">
            <span class="anonym-counter" :class="{ warn: draft.length > 240 }">
              {{ draft.length }}/280
            </span>
            <button
              class="anonym-submit"
              :disabled="!draft.trim() || store.sending"
              @click="submit"
            >
              {{ store.sending ? 'Envoi...' : 'Publier' }}
            </button>
          </div>
          <p v-if="error" class="anonym-error">{{ error }}</p>
          <p class="anonym-hint">Aucun lien avec ton compte. Aucune trace. Sois responsable.</p>
        </div>
      </div>
    </Transition>

    <!-- Board -->
    <div ref="boardRef" class="anonym-board">
      <div v-if="store.loading" class="anonym-state">Chargement...</div>
      <div v-else-if="store.posts.length === 0" class="anonym-state">
        Aucune confession pour l'instant. Brise la glace.
      </div>
      <template v-else>
        <article
          v-for="(post, i) in placedPosts"
          :key="post.id"
          class="anonym-note"
          :style="post._style"
          :data-index="i"
        >
          <p class="anonym-content">{{ post.content }}</p>
          <span class="anonym-date">{{ timeAgo(post.created_at) }}</span>
        </article>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAnonymousStore } from '../stores/anonymous'
import { timeAgo } from '../lib/time'
import { checkRateLimit } from '../lib/rateLimit'

const store = useAnonymousStore()

const showComposer = ref(false)
const draft = ref('')
const error = ref('')
const boardRef = ref(null)
const boardSize = ref({ w: 1200, h: 700 })

// Stable seeded RNG so positions are deterministic per post id
function seededRand(seed) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h += 0x6D2B79F5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_VISIBLE = 60
const GAP = 14 // px gap between notes (in raw, pre-scale units)

// Approximate the natural size of a note based on its text length.
// Wider notes for long content, taller as text wraps.
function estimateNoteSize(text) {
  const len = (text || '').length
  // Average of about 4.2 px per char at 14px Segoe UI; aim for ~16 chars/line
  let width
  if (len < 25) width = 150
  else if (len < 60) width = 190
  else if (len < 110) width = 230
  else if (len < 180) width = 260
  else width = 290
  const padX = 32 // 16 padding * 2
  const padY = 36 // top/bottom padding + date line
  const fontSize = 14
  const lineHeight = 1.4
  const charsPerLine = Math.max(8, Math.floor((width - padX) / 7.5))
  const lines = Math.max(1, Math.ceil(len / charsPerLine))
  const height = Math.max(90, lines * fontSize * lineHeight + padY)
  return { w: width, h: height }
}

// Shelf-packing: place notes left-to-right; wrap to next row when overflow.
function packShelves(items, boardW) {
  const rows = []
  let cur = []
  let curW = 0
  let curH = 0
  for (const it of items) {
    const needed = curW + (cur.length ? GAP : 0) + it.w
    if (cur.length > 0 && needed > boardW) {
      rows.push({ items: cur, h: curH, w: curW })
      cur = []
      curW = 0
      curH = 0
    }
    const x = curW + (cur.length ? GAP : 0)
    cur.push({ ...it, x })
    curW = x + it.w
    curH = Math.max(curH, it.h)
  }
  if (cur.length) rows.push({ items: cur, h: curH, w: curW })
  return rows
}

const placedPosts = computed(() => {
  const { w: boardW, h: boardH } = boardSize.value
  const total = store.posts.length
  if (total === 0 || boardW < 100 || boardH < 100) return []

  const visible = store.posts.slice(0, MAX_VISIBLE)
  // Step 1: estimate a natural size for each note
  const sized = visible.map((post) => {
    const { w, h } = estimateNoteSize(post.content)
    return { post, w, h }
  })

  // Step 2: pack into shelves at natural width
  let rows = packShelves(sized, boardW)
  let totalH = rows.reduce((s, r) => s + r.h, 0) + GAP * (rows.length - 1)

  // Step 3: if it doesn't fit vertically, scale everything down
  let scale = 1
  if (totalH > boardH) {
    scale = boardH / totalH
    // Re-pack at scaled width to use horizontal space well
    const scaledItems = sized.map((it) => ({ ...it, w: it.w * scale, h: it.h * scale }))
    rows = packShelves(scaledItems, boardW)
    totalH = rows.reduce((s, r) => s + r.h, 0) + GAP * (rows.length - 1)
  }

  // Step 4: vertically center the stack inside the board
  const yOffset = Math.max(0, (boardH - totalH) / 2)

  // Step 5: build placed list with rotation + jitter
  const placed = []
  let y = yOffset
  for (const row of rows) {
    // Center each row horizontally
    const rowOffset = Math.max(0, (boardW - row.w) / 2)
    for (const item of row.items) {
      const rand = seededRand(item.post.id)
      const rotation = (rand() - 0.5) * 6
      const jitterX = (rand() - 0.5) * 6
      const jitterY = (rand() - 0.5) * 6
      const color = item.post.color || '#fef3a7'
      placed.push({
        ...item.post,
        _style: {
          left: (rowOffset + item.x + jitterX) + 'px',
          top: (y + jitterY) + 'px',
          width: item.w + 'px',
          height: item.h + 'px',
          transform: `rotate(${rotation.toFixed(2)}deg)`,
          '--note-bg': color,
          zIndex: placed.length,
        },
      })
    }
    y += row.h + GAP
  }
  return placed
})

let resizeObserver = null

function measure() {
  if (!boardRef.value) return
  const rect = boardRef.value.getBoundingClientRect()
  boardSize.value = { w: rect.width, h: rect.height }
}

function closeComposer() {
  showComposer.value = false
  draft.value = ''
  error.value = ''
}

async function submit() {
  error.value = ''
  const limit = checkRateLimit('post')
  if (limit) {
    error.value = limit
    return
  }
  const res = await store.createPost(draft.value)
  if (res.error) {
    error.value = res.error
    return
  }
  closeComposer()
}

onMounted(async () => {
  await store.fetchPosts()
  await nextTick()
  measure()
  if (window.ResizeObserver && boardRef.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(boardRef.value)
  } else {
    window.addEventListener('resize', measure)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', measure)
})
</script>

<style scoped src="./AnonymView.css"></style>
