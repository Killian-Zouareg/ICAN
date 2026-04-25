<template>
  <div class="wiki-hero-page" :class="[hero?.side, { 'reveal-done': revealed }]">

    <!-- FULLSCREEN CINEMATIC INTRO -->
    <template v-if="!loading && hero">
      <div class="cinematic-backdrop">
        <div class="backdrop-img" :class="{ visible: revealed }" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}"></div>
        <div class="backdrop-gradient" :class="hero.side"></div>

        <!-- Particle system -->
        <canvas ref="particleCanvas" class="particle-canvas"></canvas>
      </div>

      <!-- ═══════════ HERO INTRO (VIEW MODE) ═══════════ -->
      <div v-if="!editing" class="hero-content">

        <!-- Centered controls bar -->
        <div class="controls-bar" :class="{ visible: revealed }">
          <button class="ctrl-btn" @click="$router.push('/wiki')">&larr; iWiki</button>
          <template v-if="auth.isAdmin">
            <button class="ctrl-btn edit-btn" @click="editing = !editing">&#x270F; Modifier</button>
            <button class="ctrl-btn del-btn" @click="confirmDelete">&#x1F5D1; Supprimer</button>
          </template>
        </div>

        <!-- Main hero presentation -->
        <div class="hero-intro" :class="{ visible: revealed }">

          <span class="hero-side-label" :class="hero.side">
            {{ hero.side === 'hero' ? '&#x1F31F; H\u00c9ROS DE LA NATION' : '&#x1F525; VILAIN DE LA NATION' }}
          </span>

          <h1 class="hero-title">{{ hero.alias || hero.name }}</h1>

          <h2 v-if="hero.alias" class="hero-realname">{{ hero.name }}</h2>

          <div class="hero-meta-row">
            <span v-if="hero.nationality" class="meta-chip">&#x1F30D; {{ hero.nationality }}</span>
            <span class="meta-chip status" :class="hero.status">{{ statusLabel(hero.status) }}</span>
          </div>
        </div>

        <!-- Scrollable sections -->
        <div class="hero-sections" :class="{ visible: revealed }">

          <!-- Powers -->
          <section v-if="hero.powers && hero.powers.length" class="wiki-section powers-section">
            <h3 class="section-heading">
              <span class="heading-icon">&#x26A1;</span>
              Pouvoirs & Capacit&eacute;s
            </h3>
            <div class="powers-grid">
              <div v-for="(p, i) in hero.powers" :key="i" class="power-card" :class="hero.side" :style="{ animationDelay: `${i * 0.1}s` }">
                <span class="power-icon">&#x1F4A5;</span>
                <span class="power-name">{{ p }}</span>
              </div>
            </div>
          </section>

          <!-- Stats -->
          <section v-if="hasStats" class="wiki-section stats-section">
            <h3 class="section-heading">
              <span class="heading-icon">&#x1F4CA;</span>
              Statistiques
            </h3>
            <div class="stats-display">
              <StatsRadarChart :stats="statValues" :size="220" />
              <div class="stats-bars">
                <div v-for="s in statDefs" :key="s.key" class="stat-bar-row">
                  <span class="stat-label">{{ s.label }}</span>
                  <div class="stat-bar-track">
                    <div class="stat-bar-fill" :class="hero.side" :style="{ width: `${(statValues[s.key] / 5) * 100}%` }"></div>
                  </div>
                  <span class="stat-number">{{ statValues[s.key] }}/5</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Story -->
          <section v-if="hero.story" class="wiki-section story-section">
            <h3 class="section-heading">
              <span class="heading-icon">&#x1F4D6;</span>
              Histoire
            </h3>
            <div class="story-content">
              <p class="story-text">{{ hero.story }}</p>
            </div>
          </section>

          <!-- Relations -->
          <section v-if="(hero.allies?.length) || (hero.enemies?.length)" class="wiki-section relations-section">
            <h3 class="section-heading">
              <span class="heading-icon">&#x1F91D;</span>
              Relations
            </h3>
            <div class="relations-grid">
              <div v-if="hero.allies?.length" class="relation-col allies-col">
                <h4 class="relation-title">&#x1F49A; Alli&eacute;s</h4>
                <div v-for="(a, i) in hero.allies" :key="'a'+i" class="relation-chip ally">{{ a }}</div>
              </div>
              <div v-if="hero.enemies?.length" class="relation-col enemies-col">
                <h4 class="relation-title">&#x1F5E1; Ennemis</h4>
                <div v-for="(e, i) in hero.enemies" :key="'e'+i" class="relation-chip enemy">{{ e }}</div>
              </div>
            </div>
          </section>

        </div>
      </div>

      <!-- ═══════════ EDIT MODE (ADMIN) ═══════════ -->
      <div v-else class="hero-edit-panel">
        <div class="controls-bar visible">
          <button class="ctrl-btn" @click="$router.push('/wiki')">&larr; iWiki</button>
          <button class="ctrl-btn edit-btn" @click="editing = false">&#x1F441; Voir</button>
          <button class="ctrl-btn del-btn" @click="confirmDelete">&#x1F5D1; Supprimer</button>
        </div>
        <div class="edit-scroll">
          <section class="edit-section">
            <h3>Photo</h3>
            <div class="photo-upload-zone" @click="triggerPhotoUpload">
              <div class="upload-preview" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}">
                <span v-if="!hero.photo_url">&#x1F4F7; Ajouter une photo</span>
                <span v-else class="upload-change">&#x1F4F7; Changer</span>
              </div>
            </div>
          </section>

          <section class="edit-section">
            <h3>Informations</h3>
            <div class="edit-grid">
              <div class="edit-field">
                <label>Nom</label>
                <input v-model="form.name" type="text" />
              </div>
              <div class="edit-field">
                <label>Alias</label>
                <input v-model="form.alias" type="text" />
              </div>
              <div class="edit-field">
                <label>Camp</label>
                <select v-model="form.side">
                  <option value="hero">H&eacute;ros</option>
                  <option value="villain">Vilain</option>
                </select>
              </div>
              <div class="edit-field">
                <label>Nationalit&eacute;</label>
                <input v-model="form.nationality" type="text" />
              </div>
              <div class="edit-field">
                <label>Statut</label>
                <select v-model="form.status">
                  <option value="active">Actif</option>
                  <option value="retired">Retir&eacute;</option>
                  <option value="deceased">D&eacute;c&eacute;d&eacute;</option>
                </select>
              </div>
              <div class="edit-field checkbox-field">
                <label><input type="checkbox" v-model="form.featured" /> En vitrine</label>
              </div>
            </div>
          </section>

          <section class="edit-section">
            <h3>Statistiques</h3>
            <div class="stats-edit">
              <div v-for="s in statDefs" :key="s.key" class="stat-slider">
                <label>{{ s.label }}</label>
                <input type="range" min="0" max="5" v-model.number="form[s.key]" />
                <span class="stat-val">{{ form[s.key] }}</span>
              </div>
            </div>
          </section>

          <section class="edit-section">
            <h3>Pouvoirs</h3>
            <div class="tags-editor">
              <div class="tags-list editable">
                <span v-for="(p, i) in form.powers" :key="i" class="power-card small" :class="form.side">
                  {{ p }} <button class="tag-remove" @click="form.powers.splice(i, 1)">&times;</button>
                </span>
              </div>
              <div class="tag-add">
                <input v-model="newPower" type="text" placeholder="Ajouter un pouvoir..." @keydown.enter.prevent="addPower" />
                <button @click="addPower" :disabled="!newPower.trim()">+</button>
              </div>
            </div>
          </section>

          <section class="edit-section">
            <h3>Histoire</h3>
            <textarea v-model="form.story" rows="8" placeholder="Racontez l'histoire..."></textarea>
          </section>

          <section class="edit-section">
            <h3>Alli&eacute;s</h3>
            <div class="tags-editor">
              <div class="tags-list editable">
                <span v-for="(a, i) in form.allies" :key="i" class="relation-chip ally small">
                  {{ a }} <button class="tag-remove" @click="form.allies.splice(i, 1)">&times;</button>
                </span>
              </div>
              <div class="tag-add">
                <input v-model="newAlly" type="text" placeholder="Alli\u00e9..." @keydown.enter.prevent="addAlly" />
                <button @click="addAlly" :disabled="!newAlly.trim()">+</button>
              </div>
            </div>
          </section>

          <section class="edit-section">
            <h3>Ennemis</h3>
            <div class="tags-editor">
              <div class="tags-list editable">
                <span v-for="(e, i) in form.enemies" :key="i" class="relation-chip enemy small">
                  {{ e }} <button class="tag-remove" @click="form.enemies.splice(i, 1)">&times;</button>
                </span>
              </div>
              <div class="tag-add">
                <input v-model="newEnemy" type="text" placeholder="Ennemi..." @keydown.enter.prevent="addEnemy" />
                <button @click="addEnemy" :disabled="!newEnemy.trim()">+</button>
              </div>
            </div>
          </section>

          <div class="edit-actions">
            <button class="btn-save" :disabled="saving" @click="saveHero">
              {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
          <p v-if="saveMsg" class="save-msg" :class="saveMsgType">{{ saveMsg }}</p>
        </div>
      </div>

      <input ref="photoInput" type="file" accept="image/*" style="display:none" @change="onPhotoSelected" />

      <ImageCropper
        v-if="showCropper"
        :src="cropperSrc"
        shape="square"
        title="Recadrer la photo du héros"
        @cancel="showCropper = false"
        @crop="onPhotoCropped"
      />
    </template>

    <div v-else-if="loading" class="loading-screen">
      <div class="loader-ring"></div>
    </div>
    <div v-else class="loading-screen">Personnage introuvable</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useWikiStore } from '../stores/wiki'
import StatsRadarChart from '../components/StatsRadarChart.vue'
import ImageCropper from '../components/ImageCropper.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wiki = useWikiStore()

const loading = ref(true)
const editing = ref(false)
const revealed = ref(false)
const saving = computed(() => wiki.saving)
const saveMsg = ref('')
const saveMsgType = ref('success')
const photoInput = ref(null)
const particleCanvas = ref(null)
const showCropper = ref(false)
const cropperSrc = ref('')

const newPower = ref('')
const newAlly = ref('')
const newEnemy = ref('')

let animFrameId = null

const hero = computed(() => wiki.currentHero)

const statDefs = [
  { key: 'charisme', label: 'Charisme' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'force', label: 'Force' },
  { key: 'vigueur', label: 'Vigueur' },
  { key: 'mobilite', label: 'Mobilit\u00e9' },
]

const form = ref({
  name: '', alias: '', side: 'hero', nationality: '', status: 'active',
  story: '', powers: [], allies: [], enemies: [], featured: false,
  charisme: 0, intelligence: 0, force: 0, vigueur: 0, mobilite: 0,
})

const statValues = computed(() => ({
  charisme: hero.value?.charisme || 0,
  intelligence: hero.value?.intelligence || 0,
  force: hero.value?.force || 0,
  vigueur: hero.value?.vigueur || 0,
  mobilite: hero.value?.mobilite || 0,
}))

const hasStats = computed(() => {
  const h = hero.value
  return h && (h.charisme || h.intelligence || h.force || h.vigueur || h.mobilite)
})

function statusLabel(s) {
  if (s === 'active') return 'Actif'
  if (s === 'retired') return 'Retir\u00e9'
  if (s === 'deceased') return 'D\u00e9c\u00e9d\u00e9'
  return s
}

function populateForm() {
  if (!hero.value) return
  const h = hero.value
  form.value = {
    name: h.name || '', alias: h.alias || '', side: h.side || 'hero',
    nationality: h.nationality || '', status: h.status || 'active',
    story: h.story || '', powers: [...(h.powers || [])],
    allies: [...(h.allies || [])], enemies: [...(h.enemies || [])],
    featured: h.featured || false,
    charisme: h.charisme || 0, intelligence: h.intelligence || 0,
    force: h.force || 0, vigueur: h.vigueur || 0, mobilite: h.mobilite || 0,
  }
}

function addPower() { if (newPower.value.trim()) { form.value.powers.push(newPower.value.trim()); newPower.value = '' } }
function addAlly() { if (newAlly.value.trim()) { form.value.allies.push(newAlly.value.trim()); newAlly.value = '' } }
function addEnemy() { if (newEnemy.value.trim()) { form.value.enemies.push(newEnemy.value.trim()); newEnemy.value = '' } }

function triggerPhotoUpload() { photoInput.value?.click() }

function onPhotoSelected(e) {
  const file = e.target.files?.[0]
  if (!file || !hero.value) return
  if (file.size > 5 * 1024 * 1024) {
    saveMsg.value = 'Image trop lourde (max 5 Mo)'
    saveMsgType.value = 'error'
    e.target.value = ''
    setTimeout(() => { saveMsg.value = '' }, 3000)
    return
  }
  cropperSrc.value = URL.createObjectURL(file)
  showCropper.value = true
  e.target.value = ''
}

async function onPhotoCropped(file) {
  if (!hero.value) return
  showCropper.value = false
  try {
    await wiki.uploadPhoto(hero.value.id, file)
    saveMsg.value = 'Photo mise \u00e0 jour !'
    saveMsgType.value = 'success'
  } catch (err) { saveMsg.value = err.message; saveMsgType.value = 'error' }
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

async function saveHero() {
  if (!hero.value) return
  saveMsg.value = ''
  try {
    await wiki.update(hero.value.id, { ...form.value })
    saveMsg.value = 'Sauvegard\u00e9 !'
    saveMsgType.value = 'success'
  } catch (err) { saveMsg.value = err.message; saveMsgType.value = 'error' }
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

async function confirmDelete() {
  if (!hero.value || !confirm(`Supprimer ${hero.value.name} ?`)) return
  try { await wiki.remove(hero.value.id); router.push('/wiki') }
  catch (err) { alert(err.message) }
}

// ═══════════ PARTICLE SYSTEM ═══════════
function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const particles = []
  const isHero = hero.value?.side === 'hero'
  const count = 60

  function resize() {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }
  resize()
  window.addEventListener('resize', resize)

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      size: Math.random() * (isHero ? 3 : 2.5) + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: isHero ? -(Math.random() * 0.8 + 0.2) : (Math.random() * 0.5 + 0.3),
      opacity: Math.random() * 0.6 + 0.2,
      flickerSpeed: Math.random() * 0.02 + 0.005,
      flickerOffset: Math.random() * Math.PI * 2,
      // Ember rotation for villains
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
    })
  }

  let time = 0
  function draw() {
    time++
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    ctx.clearRect(0, 0, w, h)

    for (const p of particles) {
      p.x += p.speedX
      p.y += p.speedY
      p.angle += p.rotSpeed

      // Wrap around
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
      if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
      if (p.x < -10) p.x = w + 10
      if (p.x > w + 10) p.x = -10

      const flicker = Math.sin(time * p.flickerSpeed + p.flickerOffset) * 0.3 + 0.7
      const alpha = p.opacity * flicker

      ctx.save()
      ctx.translate(p.x, p.y)

      if (isHero) {
        // Gold sparkle
        ctx.globalAlpha = alpha
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2)
        grad.addColorStop(0, 'rgba(255, 215, 0, 1)')
        grad.addColorStop(0.4, 'rgba(255, 180, 0, 0.6)')
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2)
        ctx.fill()
        // Bright core
        ctx.globalAlpha = alpha * 1.2
        ctx.fillStyle = '#fff8dc'
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Ember / ash particle
        ctx.rotate(p.angle)
        ctx.globalAlpha = alpha
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.5)
        grad.addColorStop(0, 'rgba(255, 80, 40, 0.9)')
        grad.addColorStop(0.5, 'rgba(200, 30, 15, 0.5)')
        grad.addColorStop(1, 'rgba(60, 10, 5, 0)')
        ctx.fillStyle = grad
        // Irregular ember shape
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2)
        ctx.fill()
        // Bright core
        ctx.globalAlpha = alpha * 0.8
        ctx.fillStyle = 'rgba(255, 160, 50, 0.8)'
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    animFrameId = requestAnimationFrame(draw)
  }
  animFrameId = requestAnimationFrame(draw)
}

watch(() => route.params.id, async (id) => {
  if (id) {
    loading.value = true
    editing.value = false
    revealed.value = false
    await wiki.fetchOne(id)
    populateForm()
    loading.value = false
    await nextTick()
    setTimeout(() => { revealed.value = true }, 100)
    initParticles()
  }
}, { immediate: false })

watch(editing, (val) => { if (val) populateForm() })

onMounted(async () => {
  await wiki.fetchOne(route.params.id)
  populateForm()
  loading.value = false
  await nextTick()
  setTimeout(() => { revealed.value = true }, 100)
  initParticles()
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})
</script>

<style scoped src="./WikiHeroView.css"></style>
