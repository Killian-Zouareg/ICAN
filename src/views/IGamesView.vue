<template>
  <div class="igames-page">
    <div class="game-header">
      <button @click="$router.back()" class="back-btn">&larr;</button>
      <h1 class="header-title">iGames</h1>
      <span v-if="bestScore > 0" class="best-score">&#x1F3C6; {{ bestScore }}</span>
    </div>

    <!-- Game tabs -->
    <div class="game-tabs">
      <button class="game-tab active">&#x1F3C3; iRunner</button>
      <button class="game-tab" @click="$router.push('/igames/arena')">&#x2694; iArena</button>
      <button class="game-tab" @click="$router.push('/igames/territory')">&#x1F3F0; Territoires</button>
    </div>

    <!-- Upload zone -->
    <div v-if="!playerImg" class="upload-zone">
      <div class="upload-card">
        <div class="upload-icon">&#x1F3AE;</div>
        <h2>iRunner</h2>
        <p class="upload-desc">Uploadez votre photo pour jouer !</p>
        <p class="upload-sub">Votre personnage devra sauter par-dessus les bombes et les vilains.</p>
        <label class="upload-btn">
          Choisir une photo
          <input type="file" accept="image/*" hidden @change="onFileSelect" />
        </label>
        <div v-if="previewUrl" class="preview-zone">
          <img :src="previewUrl" class="preview-img" />
          <p class="loading-hint">Chargement...</p>
        </div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="leaderboard">
      <h3 class="lb-title">&#x1F3C6; Classement</h3>
      <div v-if="lbLoading" class="lb-loading">Chargement...</div>
      <div v-else-if="leaderboard.length === 0" class="lb-empty">Aucun score pour l'instant</div>
      <div v-else class="lb-list">
        <div v-for="(entry, i) in leaderboard" :key="entry.id" class="lb-row" :class="{ mine: entry.profile_id === currentProfileId, top3: i < 3 }">
          <span class="lb-rank" :class="'rank-' + (i + 1)">{{ i < 3 ? ['&#x1F947;','&#x1F948;','&#x1F949;'][i] : (i + 1) }}</span>
          <img v-if="entry.profiles?.avatar_url" :src="entry.profiles.avatar_url" class="lb-avatar" />
          <span v-else class="lb-avatar lb-avatar-placeholder">&#x1F464;</span>
          <span class="lb-name">{{ entry.profiles?.display_name || 'Inconnu' }}</span>
          <span class="lb-score">{{ entry.best_score }}</span>
        </div>
      </div>
    </div>

    <!-- Game zone -->
    <div v-if="playerImg" class="game-container">
      <canvas ref="canvasRef" @click="jump" @touchstart.prevent="jump"></canvas>

      <div class="controls-hint">
        Espace / Clic pour sauter
      </div>

      <!-- Game over overlay -->
      <div v-if="gameOver" class="gameover-overlay">
        <div class="gameover-card">
          <div class="gameover-icon">&#x1F4A5;</div>
          <h2>Game Over</h2>
          <p class="gameover-score">Score : <strong>{{ score }}</strong></p>
          <p v-if="score >= bestScore && score > 0" class="new-record">&#x1F31F; Nouveau record !</p>
          <div class="gameover-actions">
            <button class="retry-btn" @click="restartGame">&#x1F504; Rejouer</button>
            <button class="change-btn" @click="changePhoto">&#x1F4F7; Changer de photo</button>
          </div>
        </div>
      </div>

      <!-- Start prompt -->
      <div v-if="!running && !gameOver" class="start-overlay" @click="beginRun">
        <div class="start-card">
          <img :src="previewUrl" class="start-avatar" />
          <p>Cliquez pour commencer !</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const currentProfileId = computed(() => auth.activeProfile?.id)

const canvasRef = ref(null)
const playerImg = ref(null)
const previewUrl = ref(null)
const gameOver = ref(false)
const running = ref(false)
const score = ref(0)
const bestScore = ref(parseInt(localStorage.getItem('igames_best') || '0'))
const leaderboard = ref([])
const lbLoading = ref(true)

async function fetchLeaderboard() {
  lbLoading.value = true
  try {
    const { data } = await supabase
      .from('game_scores')
      .select('id, profile_id, best_score, profiles(display_name, avatar_url)')
      .order('best_score', { ascending: false })
      .limit(20)
    leaderboard.value = data || []
  } catch { /* ignore */ }
  lbLoading.value = false
}

async function submitScore(newScore) {
  if (!currentProfileId.value || newScore <= 0) return
  try {
    // Check existing score
    const { data: existing } = await supabase
      .from('game_scores')
      .select('id, best_score')
      .eq('profile_id', currentProfileId.value)
      .eq('game', 'irunner')
      .maybeSingle()

    if (existing) {
      if (newScore > existing.best_score) {
        await supabase
          .from('game_scores')
          .update({ best_score: newScore, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }
    } else {
      await supabase
        .from('game_scores')
        .insert({ profile_id: currentProfileId.value, game: 'irunner', best_score: newScore })
    }
    await fetchLeaderboard()
  } catch { /* ignore */ }
}

// Game state (not reactive for perf)
let ctx = null
let animId = null
let canvasW = 0
let canvasH = 0
const GROUND_H = 2
const PLAYER_SIZE = 50
const GRAVITY = 0.6
const JUMP_FORCE = -11
let player = { x: 60, y: 0, vy: 0, onGround: true }
let obstacles = []
let spawnTimer = 0
let speed = 4
let frameCount = 0
let lastTime = 0

const OBSTACLE_TYPES = [
  { emoji: '\uD83D\uDCA3', label: 'bomb' },
  { emoji: '\uD83E\uDDB9', label: 'villain' },
  { emoji: '\u2620\uFE0F', label: 'skull' },
]

function onFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  previewUrl.value = url
  const img = new Image()
  img.onload = async () => {
    playerImg.value = img
    await nextTick()
    initCanvas()
  }
  img.src = url
}

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resizeCanvas()
  resetState()
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const container = canvas.parentElement
  const w = Math.min(container.clientWidth, 800)
  const h = 220
  canvas.width = w * window.devicePixelRatio
  canvas.height = h * window.devicePixelRatio
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  canvasW = w
  canvasH = h
}

function resetState() {
  const groundY = canvasH - GROUND_H - PLAYER_SIZE
  player = { x: 60, y: groundY, vy: 0, onGround: true }
  obstacles = []
  spawnTimer = 0
  speed = 4
  frameCount = 0
  score.value = 0
  gameOver.value = false
  running.value = false
  lastTime = 0
  drawFrame()
}

function beginRun() {
  running.value = true
  lastTime = performance.now()
  animId = requestAnimationFrame(loop)
}

function restartGame() {
  resetState()
  beginRun()
}

function changePhoto() {
  playerImg.value = null
  gameOver.value = false
  running.value = false
  if (animId) cancelAnimationFrame(animId)
}

function jump() {
  if (!running.value || gameOver.value) return
  if (player.onGround) {
    player.vy = JUMP_FORCE
    player.onGround = false
  }
}

function onKeydown(e) {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault()
    if (!running.value && !gameOver.value && playerImg.value) {
      beginRun()
    } else if (gameOver.value) {
      restartGame()
    } else {
      jump()
    }
  }
}

function loop(timestamp) {
  if (!running.value || gameOver.value) return

  const dt = Math.min((timestamp - lastTime) / 16.67, 2) // normalize to ~60fps
  lastTime = timestamp
  frameCount++

  // Speed up over time
  speed = 4 + frameCount * 0.002

  // Update player
  const groundY = canvasH - GROUND_H - PLAYER_SIZE
  player.vy += GRAVITY * dt
  player.y += player.vy * dt
  if (player.y >= groundY) {
    player.y = groundY
    player.vy = 0
    player.onGround = true
  }

  // Spawn obstacles
  spawnTimer -= dt
  if (spawnTimer <= 0) {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
    const size = 32 + Math.random() * 16
    obstacles.push({
      x: canvasW + 10,
      y: canvasH - GROUND_H - size,
      w: size,
      h: size,
      emoji: type.emoji,
    })
    spawnTimer = 40 + Math.random() * 40
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed * dt
    if (obstacles[i].x + obstacles[i].w < 0) {
      obstacles.splice(i, 1)
    }
  }

  // Collision
  const px = player.x
  const py = player.y
  const pw = PLAYER_SIZE - 10 // slight padding
  const ph = PLAYER_SIZE - 6
  for (const obs of obstacles) {
    if (
      px + 5 < obs.x + obs.w &&
      px + 5 + pw > obs.x &&
      py + 3 < obs.y + obs.h &&
      py + 3 + ph > obs.y
    ) {
      // Game over
      running.value = false
      gameOver.value = true
      if (score.value > bestScore.value) {
        bestScore.value = score.value
        localStorage.setItem('igames_best', String(score.value))
      }
      submitScore(score.value)
      drawFrame()
      return
    }
  }

  // Score
  score.value = Math.floor(frameCount / 4)

  drawFrame()
  animId = requestAnimationFrame(loop)
}

function drawFrame() {
  if (!ctx) return
  // Clear
  ctx.clearRect(0, 0, canvasW, canvasH)

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH)
  grad.addColorStop(0, '#0d1520')
  grad.addColorStop(1, '#15202b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Ground
  ctx.fillStyle = '#38444d'
  ctx.fillRect(0, canvasH - GROUND_H, canvasW, GROUND_H)

  // Ground dots (deco)
  ctx.fillStyle = '#4a5568'
  for (let i = 0; i < canvasW; i += 30) {
    ctx.fillRect(i - ((frameCount * 2) % 30), canvasH - GROUND_H - 1, 2, 1)
  }

  // Player
  if (playerImg.value) {
    ctx.drawImage(playerImg.value, player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)
  }

  // Obstacles
  ctx.font = '32px serif'
  ctx.textBaseline = 'top'
  for (const obs of obstacles) {
    ctx.fillText(obs.emoji, obs.x, obs.y)
  }

  // Score
  ctx.fillStyle = '#e1e8ed'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(String(score.value), canvasW - 12, 10)
  ctx.textAlign = 'left'
}

let resizeHandler = null

onMounted(() => {
  fetchLeaderboard()
  window.addEventListener('keydown', onKeydown)
  resizeHandler = () => {
    if (canvasRef.value && ctx) {
      resizeCanvas()
      drawFrame()
    }
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (animId) cancelAnimationFrame(animId)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped src="./IGamesView.css"></style>
