<template>
  <div class="wiki-page">
    <!-- Top bar -->
    <div class="wiki-top-bar">
      <button @click="$router.back()" class="back-btn">&larr;</button>
      <h1 class="top-bar-title">iWiki</h1>
    </div>

    <!-- Tabs -->
    <div class="wiki-tabs">
      <button class="wiki-tab" :class="{ active: tab === 'showcase' }" @click="tab = 'showcase'">
        &#x2B50; Vitrine
      </button>
      <button class="wiki-tab" :class="{ active: tab === 'directory' }" @click="tab = 'directory'">
        &#x1F4DA; R&eacute;pertoire
      </button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <!-- ═══════════ VITRINE ═══════════ -->
    <div v-else-if="tab === 'showcase'" class="showcase">

      <!-- HEROES SECTION -->
      <section class="showcase-section heroes-section">
        <div class="particles heroes-particles">
          <span v-for="i in 20" :key="'hp'+i" class="particle hero-particle"></span>
        </div>
        <h2 class="showcase-title heroes-title">
          <span class="title-icon">&#x1F31F;</span>
          H&eacute;ros de la Nation
          <span class="title-icon">&#x1F31F;</span>
        </h2>
        <div class="showcase-grid">
          <div
            v-for="hero in featuredHeroes"
            :key="hero.id"
            class="showcase-card hero-card"
            @mousemove="onCardMouseMove($event, hero.id)"
            @mouseleave="onCardMouseLeave(hero.id)"
            @click="$router.push(`/wiki/${hero.id}`)"
            :style="cardStyles[hero.id] || {}"
          >
            <div class="card-glow hero-glow"></div>
            <div class="card-photo" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}">
              <span v-if="!hero.photo_url" class="card-photo-placeholder">&#x1F9B8;</span>
            </div>
            <div class="card-info">
              <span class="card-alias">{{ hero.alias || hero.name }}</span>
              <span class="card-name">{{ hero.name }}</span>
              <span class="card-status" :class="hero.status">{{ statusLabel(hero.status) }}</span>
            </div>
          </div>
        </div>
        <p v-if="featuredHeroes.length === 0" class="showcase-empty">Aucun h&eacute;ros en vitrine</p>
      </section>

      <!-- SEPARATOR -->
      <div class="showcase-separator">
        <div class="separator-line"></div>
        <span class="separator-icon">&#x2694;</span>
        <div class="separator-line"></div>
      </div>

      <!-- VILLAINS SECTION -->
      <section class="showcase-section villains-section">
        <div class="particles villains-particles">
          <span v-for="i in 20" :key="'vp'+i" class="particle villain-particle"></span>
        </div>
        <h2 class="showcase-title villains-title">
          <span class="title-icon">&#x1F525;</span>
          Vilains de la Nation
          <span class="title-icon">&#x1F525;</span>
        </h2>
        <div class="showcase-grid">
          <div
            v-for="villain in featuredVillains"
            :key="villain.id"
            class="showcase-card villain-card"
            @mousemove="onCardMouseMove($event, villain.id)"
            @mouseleave="onCardMouseLeave(villain.id)"
            @click="$router.push(`/wiki/${villain.id}`)"
            :style="cardStyles[villain.id] || {}"
          >
            <div class="card-glow villain-glow"></div>
            <div class="card-photo" :style="villain.photo_url ? { backgroundImage: `url(${villain.photo_url})` } : {}">
              <span v-if="!villain.photo_url" class="card-photo-placeholder">&#x1F9B9;</span>
            </div>
            <div class="card-info">
              <span class="card-alias">{{ villain.alias || villain.name }}</span>
              <span class="card-name">{{ villain.name }}</span>
              <span class="card-status" :class="villain.status">{{ statusLabel(villain.status) }}</span>
            </div>
          </div>
        </div>
        <p v-if="featuredVillains.length === 0" class="showcase-empty">Aucun vilain en vitrine</p>
      </section>
    </div>

    <!-- ═══════════ REPERTOIRE ═══════════ -->
    <div v-else-if="tab === 'directory'" class="directory">
      <!-- Search & filters -->
      <div class="directory-controls">
        <input v-model="search" type="text" placeholder="Rechercher un h&eacute;ros ou vilain..." class="directory-search" />
        <div class="directory-filters">
          <button class="filter-btn" :class="{ active: sideFilter === 'all' }" @click="sideFilter = 'all'">Tous</button>
          <button class="filter-btn hero-filter" :class="{ active: sideFilter === 'hero' }" @click="sideFilter = 'hero'">H&eacute;ros</button>
          <button class="filter-btn villain-filter" :class="{ active: sideFilter === 'villain' }" @click="sideFilter = 'villain'">Vilains</button>
        </div>
      </div>

      <!-- Admin create button -->
      <button v-if="auth.isAdmin" class="create-btn" @click="showCreateModal = true">
        + Nouveau personnage
      </button>

      <!-- List -->
      <div class="directory-list">
        <div
          v-for="hero in filteredHeroes"
          :key="hero.id"
          class="directory-item"
          @click="$router.push(`/wiki/${hero.id}`)"
        >
          <div class="dir-photo" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}">
            <span v-if="!hero.photo_url" class="dir-photo-placeholder">{{ hero.side === 'hero' ? '&#x1F9B8;' : '&#x1F9B9;' }}</span>
          </div>
          <div class="dir-info">
            <span class="dir-name">{{ hero.name }}</span>
            <span v-if="hero.alias" class="dir-alias">&laquo; {{ hero.alias }} &raquo;</span>
            <span class="dir-meta">
              {{ hero.nationality || 'Inconnue' }} &middot;
              <span :class="'side-badge ' + hero.side">{{ hero.side === 'hero' ? 'H\u00e9ros' : 'Vilain' }}</span>
              &middot;
              <span :class="'status-badge ' + hero.status">{{ statusLabel(hero.status) }}</span>
            </span>
          </div>
          <span class="dir-arrow">&rsaquo;</span>
        </div>
        <p v-if="filteredHeroes.length === 0" class="directory-empty">Aucun r&eacute;sultat</p>
      </div>
    </div>

    <!-- ═══════════ CREATE MODAL ═══════════ -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-content wiki-modal">
          <h3>Nouveau personnage</h3>
          <div class="modal-field">
            <label>Nom</label>
            <input v-model="newHero.name" type="text" placeholder="Nom complet" />
          </div>
          <div class="modal-field">
            <label>Alias</label>
            <input v-model="newHero.alias" type="text" placeholder="Nom de h&eacute;ros/vilain" />
          </div>
          <div class="modal-field">
            <label>Camp</label>
            <select v-model="newHero.side">
              <option value="hero">H&eacute;ros</option>
              <option value="villain">Vilain</option>
            </select>
          </div>
          <div class="modal-field">
            <label>Nationalit&eacute;</label>
            <input v-model="newHero.nationality" type="text" placeholder="Nationalit&eacute;" />
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showCreateModal = false">Annuler</button>
            <button class="btn-create" :disabled="!newHero.name || saving" @click="createHero">
              {{ saving ? 'Cr&eacute;ation...' : 'Cr&eacute;er' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useWikiStore } from '../stores/wiki'

const auth = useAuthStore()
const wiki = useWikiStore()

const tab = ref('showcase')
const search = ref('')
const sideFilter = ref('all')
const showCreateModal = ref(false)
const loading = ref(true)
const saving = computed(() => wiki.saving)
const cardStyles = reactive({})

const newHero = ref({ name: '', alias: '', side: 'hero', nationality: '' })

// Computed
const featuredHeroes = computed(() =>
  wiki.heroes.filter(h => h.featured && h.side === 'hero')
)
const featuredVillains = computed(() =>
  wiki.heroes.filter(h => h.featured && h.side === 'villain')
)
const filteredHeroes = computed(() => {
  let list = wiki.heroes
  if (sideFilter.value !== 'all') {
    list = list.filter(h => h.side === sideFilter.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(h =>
      h.name.toLowerCase().includes(q) ||
      (h.alias && h.alias.toLowerCase().includes(q)) ||
      (h.nationality && h.nationality.toLowerCase().includes(q))
    )
  }
  return list
})

function statusLabel(s) {
  if (s === 'active') return 'Actif'
  if (s === 'retired') return 'Retir\u00e9'
  if (s === 'deceased') return 'D\u00e9c\u00e9d\u00e9'
  return s
}

// 3D card hover
function onCardMouseMove(e, id) {
  const card = e.currentTarget
  const rect = card.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const rotateX = ((y - centerY) / centerY) * -8
  const rotateY = ((x - centerX) / centerX) * 8
  cardStyles[id] = {
    transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`,
  }
}

function onCardMouseLeave(id) {
  cardStyles[id] = { transform: 'perspective(800px) rotateX(0) rotateY(0) scale(1)' }
}

async function createHero() {
  try {
    const hero = await wiki.create({ ...newHero.value })
    showCreateModal.value = false
    newHero.value = { name: '', alias: '', side: 'hero', nationality: '' }
    // Navigate to the new hero
    const router = (await import('vue-router')).useRouter()
    // fallback: just stay on directory
  } catch (err) {
    alert(err.message)
  }
}

onMounted(async () => {
  await wiki.fetchAll()
  loading.value = false
})
</script>

<style scoped src="./WikiView.css"></style>
