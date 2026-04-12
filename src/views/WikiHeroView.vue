<template>
  <div class="wiki-hero-page">
    <!-- Top bar -->
    <div class="hero-top-bar">
      <button @click="$router.push('/wiki')" class="back-btn">&larr; iWiki</button>
      <div v-if="auth.isAdmin && hero" class="top-bar-actions">
        <button class="edit-toggle" @click="editing = !editing">
          {{ editing ? 'Voir' : 'Modifier' }}
        </button>
        <button class="delete-btn" @click="confirmDelete">Supprimer</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <div v-else-if="!hero" class="loading">Personnage introuvable</div>

    <template v-else>
      <!-- ═══════════ CINEMATIC HEADER ═══════════ -->
      <div class="hero-header" :class="hero.side">
        <div class="header-bg" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}"></div>
        <div class="header-overlay"></div>
        <div class="header-particles">
          <span v-for="i in 12" :key="'p'+i" class="particle" :class="hero.side === 'hero' ? 'hero-particle' : 'villain-particle'"></span>
        </div>
        <div class="header-content">
          <div class="header-photo-wrapper" @click="editing && triggerPhotoUpload()">
            <div class="header-photo" :style="hero.photo_url ? { backgroundImage: `url(${hero.photo_url})` } : {}">
              <span v-if="!hero.photo_url" class="photo-placeholder">{{ hero.side === 'hero' ? '&#x1F9B8;' : '&#x1F9B9;' }}</span>
            </div>
            <div v-if="editing" class="photo-edit-overlay">&#x1F4F7;</div>
          </div>
          <div class="header-text">
            <span class="side-badge" :class="hero.side">{{ hero.side === 'hero' ? '&#x1F31F; H\u00e9ros' : '&#x1F525; Vilain' }}</span>
            <h1 class="hero-alias">{{ hero.alias || hero.name }}</h1>
            <h2 class="hero-name">{{ hero.name }}</h2>
            <div class="hero-meta">
              <span v-if="hero.nationality">&#x1F30D; {{ hero.nationality }}</span>
              <span class="status-tag" :class="hero.status">{{ statusLabel(hero.status) }}</span>
            </div>
          </div>
        </div>
      </div>

      <input ref="photoInput" type="file" accept="image/*" style="display:none" @change="onPhotoSelected" />

      <!-- ═══════════ VIEW MODE ═══════════ -->
      <div v-if="!editing" class="hero-body">
        <!-- Stats -->
        <section class="hero-section" v-if="hasStats">
          <h3 class="section-title">&#x1F4CA; Statistiques</h3>
          <div class="stats-container">
            <StatsRadarChart :stats="statValues" :size="240" />
          </div>
        </section>

        <!-- Powers -->
        <section class="hero-section" v-if="hero.powers && hero.powers.length">
          <h3 class="section-title">&#x26A1; Pouvoirs & Capacit&eacute;s</h3>
          <div class="tags-list">
            <span v-for="(p, i) in hero.powers" :key="i" class="power-tag" :class="hero.side">{{ p }}</span>
          </div>
        </section>

        <!-- Story -->
        <section class="hero-section" v-if="hero.story">
          <h3 class="section-title">&#x1F4D6; Histoire</h3>
          <p class="story-text">{{ hero.story }}</p>
        </section>

        <!-- Relations -->
        <section class="hero-section" v-if="(hero.allies && hero.allies.length) || (hero.enemies && hero.enemies.length)">
          <h3 class="section-title">&#x1F91D; Relations</h3>
          <div v-if="hero.allies && hero.allies.length" class="relation-group">
            <span class="relation-label">Alli&eacute;s</span>
            <div class="tags-list">
              <span v-for="(a, i) in hero.allies" :key="'a'+i" class="relation-tag ally">{{ a }}</span>
            </div>
          </div>
          <div v-if="hero.enemies && hero.enemies.length" class="relation-group">
            <span class="relation-label">Ennemis</span>
            <div class="tags-list">
              <span v-for="(e, i) in hero.enemies" :key="'e'+i" class="relation-tag enemy">{{ e }}</span>
            </div>
          </div>
        </section>

        <!-- Featured badge -->
        <div v-if="hero.featured" class="featured-badge">
          &#x2B50; En vitrine
        </div>
      </div>

      <!-- ═══════════ EDIT MODE (ADMIN) ═══════════ -->
      <div v-else class="hero-edit">
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
            <div class="edit-field">
              <label>
                <input type="checkbox" v-model="form.featured" /> En vitrine
              </label>
            </div>
          </div>
        </section>

        <section class="edit-section">
          <h3>Statistiques</h3>
          <div class="stats-edit">
            <div v-for="s in statDefs" :key="s.key" class="stat-slider">
              <label>{{ s.emoji }} {{ s.label }}</label>
              <input type="range" min="0" max="5" v-model.number="form[s.key]" />
              <span class="stat-val">{{ form[s.key] }}</span>
            </div>
          </div>
        </section>

        <section class="edit-section">
          <h3>Pouvoirs</h3>
          <div class="tags-editor">
            <div class="tags-list editable">
              <span v-for="(p, i) in form.powers" :key="i" class="power-tag" :class="form.side">
                {{ p }}
                <button class="tag-remove" @click="form.powers.splice(i, 1)">&times;</button>
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
          <textarea v-model="form.story" rows="8" placeholder="Racontez l'histoire de ce personnage..."></textarea>
        </section>

        <section class="edit-section">
          <h3>Alli&eacute;s</h3>
          <div class="tags-editor">
            <div class="tags-list editable">
              <span v-for="(a, i) in form.allies" :key="i" class="relation-tag ally">
                {{ a }}
                <button class="tag-remove" @click="form.allies.splice(i, 1)">&times;</button>
              </span>
            </div>
            <div class="tag-add">
              <input v-model="newAlly" type="text" placeholder="Ajouter un alli&eacute;..." @keydown.enter.prevent="addAlly" />
              <button @click="addAlly" :disabled="!newAlly.trim()">+</button>
            </div>
          </div>
        </section>

        <section class="edit-section">
          <h3>Ennemis</h3>
          <div class="tags-editor">
            <div class="tags-list editable">
              <span v-for="(e, i) in form.enemies" :key="i" class="relation-tag enemy">
                {{ e }}
                <button class="tag-remove" @click="form.enemies.splice(i, 1)">&times;</button>
              </span>
            </div>
            <div class="tag-add">
              <input v-model="newEnemy" type="text" placeholder="Ajouter un ennemi..." @keydown.enter.prevent="addEnemy" />
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
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useWikiStore } from '../stores/wiki'
import StatsRadarChart from '../components/StatsRadarChart.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wiki = useWikiStore()

const loading = ref(true)
const editing = ref(false)
const saving = computed(() => wiki.saving)
const saveMsg = ref('')
const saveMsgType = ref('success')
const photoInput = ref(null)

const newPower = ref('')
const newAlly = ref('')
const newEnemy = ref('')

const hero = computed(() => wiki.currentHero)

const statDefs = [
  { key: 'charisme', label: 'Charisme', emoji: '&#x1F60E;' },
  { key: 'intelligence', label: 'Intelligence', emoji: '&#x1F9E0;' },
  { key: 'force', label: 'Force', emoji: '&#x1F4AA;' },
  { key: 'vigueur', label: 'Vigueur', emoji: '&#x2764;' },
  { key: 'mobilite', label: 'Mobilit\u00e9', emoji: '&#x1F3C3;' },
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
    name: h.name || '',
    alias: h.alias || '',
    side: h.side || 'hero',
    nationality: h.nationality || '',
    status: h.status || 'active',
    story: h.story || '',
    powers: [...(h.powers || [])],
    allies: [...(h.allies || [])],
    enemies: [...(h.enemies || [])],
    featured: h.featured || false,
    charisme: h.charisme || 0,
    intelligence: h.intelligence || 0,
    force: h.force || 0,
    vigueur: h.vigueur || 0,
    mobilite: h.mobilite || 0,
  }
}

function addPower() {
  if (newPower.value.trim()) {
    form.value.powers.push(newPower.value.trim())
    newPower.value = ''
  }
}
function addAlly() {
  if (newAlly.value.trim()) {
    form.value.allies.push(newAlly.value.trim())
    newAlly.value = ''
  }
}
function addEnemy() {
  if (newEnemy.value.trim()) {
    form.value.enemies.push(newEnemy.value.trim())
    newEnemy.value = ''
  }
}

function triggerPhotoUpload() {
  photoInput.value?.click()
}

async function onPhotoSelected(e) {
  const file = e.target.files?.[0]
  if (!file || !hero.value) return
  try {
    await wiki.uploadPhoto(hero.value.id, file)
    saveMsg.value = 'Photo mise \u00e0 jour !'
    saveMsgType.value = 'success'
  } catch (err) {
    saveMsg.value = err.message
    saveMsgType.value = 'error'
  }
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

async function saveHero() {
  if (!hero.value) return
  saveMsg.value = ''
  try {
    await wiki.update(hero.value.id, { ...form.value })
    saveMsg.value = 'Sauvegard\u00e9 !'
    saveMsgType.value = 'success'
  } catch (err) {
    saveMsg.value = err.message
    saveMsgType.value = 'error'
  }
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

async function confirmDelete() {
  if (!hero.value) return
  if (!confirm(`Supprimer ${hero.value.name} ?`)) return
  try {
    await wiki.remove(hero.value.id)
    router.push('/wiki')
  } catch (err) {
    alert(err.message)
  }
}

watch(() => route.params.id, async (id) => {
  if (id) {
    loading.value = true
    editing.value = false
    await wiki.fetchOne(id)
    populateForm()
    loading.value = false
  }
}, { immediate: false })

watch(editing, (val) => {
  if (val) populateForm()
})

onMounted(async () => {
  await wiki.fetchOne(route.params.id)
  populateForm()
  loading.value = false
})
</script>

<style scoped src="./WikiHeroView.css"></style>
