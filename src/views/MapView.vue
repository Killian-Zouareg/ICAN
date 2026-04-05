<template>
  <div class="map-page">
    <!-- Toolbar -->
    <div class="map-toolbar">
      <div class="map-toolbar-left">
        <button @click="$router.back()" class="back-btn">&larr;</button>
        <h2 class="map-title">Carte d'Allentown</h2>
      </div>
      <div class="map-toolbar-right">
        <button
          v-if="auth.isAdmin"
          class="add-btn"
          :class="{ active: addMode }"
          @click="toggleAddMode"
        >
          {{ addMode ? '&#x2716; Annuler' : '&#x2795; Ajouter un lieu' }}
        </button>
      </div>
    </div>

    <!-- Category filters -->
    <div class="map-filters">
      <button
        class="filter-chip"
        :class="{ active: !store.filterCategory }"
        @click="store.filterCategory = null"
      >
        Tous
      </button>
      <button
        v-for="(cat, key) in store.CATEGORIES"
        :key="key"
        class="filter-chip"
        :class="{ active: store.filterCategory === key }"
        :style="store.filterCategory === key ? { background: cat.color + '30', color: cat.color, borderColor: cat.color } : {}"
        @click="store.filterCategory = store.filterCategory === key ? null : key"
      >
        {{ cat.emoji }} {{ cat.label }}
      </button>
    </div>

    <!-- Map container -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-container" :class="{ 'add-mode': addMode }"></div>
      <div class="map-vignette"></div>

      <!-- Add mode hint -->
      <div v-if="addMode" class="add-mode-hint">
        Cliquez sur la carte pour placer un lieu
      </div>
    </div>

    <!-- Detail panel (outside map-wrapper to avoid Leaflet z-index conflicts) -->
    <Transition name="panel">
      <div v-if="store.selectedLocation && !showForm" class="detail-panel">
        <button class="panel-close" @click="store.clearSelection()">&times;</button>

        <div v-if="store.selectedLocation.image_url" class="panel-image">
          <img :src="store.selectedLocation.image_url" :alt="store.selectedLocation.name" />
        </div>

        <div class="panel-body">
          <div class="panel-header">
            <span
              class="panel-category-badge"
              :style="{ background: getCategoryColor(store.selectedLocation.category) + '25', color: getCategoryColor(store.selectedLocation.category) }"
            >
              {{ getCategoryEmoji(store.selectedLocation.category) }} {{ getCategoryLabel(store.selectedLocation.category) }}
            </span>
          </div>

          <h3 class="panel-name">{{ store.selectedLocation.name }}</h3>

          <p v-if="store.selectedLocation.description" class="panel-desc">
            {{ store.selectedLocation.description }}
          </p>

          <!-- Linked profile -->
          <router-link
            v-if="store.selectedLocation.linked_profile"
            :to="`/user/${store.selectedLocation.linked_profile.username}`"
            class="panel-profile-link"
          >
            <UserAvatar
              :url="store.selectedLocation.linked_profile.avatar_url"
              :name="store.selectedLocation.linked_profile.display_name"
              :size="28"
            />
            <div class="panel-profile-info">
              <span class="panel-profile-name">{{ store.selectedLocation.linked_profile.display_name }}</span>
              <span class="panel-profile-handle">@{{ store.selectedLocation.linked_profile.username }}</span>
            </div>
          </router-link>

          <!-- Admin actions -->
          <div v-if="auth.isAdmin" class="panel-admin-actions">
            <button class="panel-edit-btn" @click="startEdit(store.selectedLocation)">Modifier</button>
            <button class="panel-delete-btn" @click="handleDelete(store.selectedLocation)">Supprimer</button>
          </div>

          <!-- Recent posts mentioning this location -->
          <div class="panel-posts-section">
            <h4 class="panel-posts-title">Posts r&eacute;cents</h4>
            <div v-if="store.loadingPosts" class="panel-posts-loading">Chargement...</div>
            <div v-else-if="store.locationPosts.length === 0" class="panel-posts-empty">
              Aucun post ne mentionne ce lieu
            </div>
            <router-link
              v-else
              v-for="post in store.locationPosts"
              :key="post.id"
              :to="`/post/${post.id}`"
              class="panel-post-card"
            >
              <UserAvatar
                :url="post.avatar_url"
                :name="post.display_name || post.username"
                :size="24"
              />
              <div class="panel-post-info">
                <div class="panel-post-header">
                  <span class="panel-post-author">{{ post.display_name }}</span>
                  <span class="panel-post-time">{{ timeAgo(post.created_at) }}</span>
                </div>
                <p class="panel-post-content">{{ post.content?.slice(0, 80) }}{{ post.content?.length > 80 ? '...' : '' }}</p>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add/Edit Form modal -->
    <Transition name="panel">
      <div v-if="showForm" class="form-overlay" @click.self="cancelForm">
        <div class="form-modal">
          <h3 class="form-title">{{ editingLocation ? 'Modifier le lieu' : 'Nouveau lieu' }}</h3>

          <div class="form-field">
            <label>Nom</label>
            <input v-model="formData.name" type="text" maxlength="100" placeholder="Nom du lieu" />
          </div>

          <div class="form-field">
            <label>Description</label>
            <textarea v-model="formData.description" rows="3" maxlength="500" placeholder="Description..."></textarea>
          </div>

          <div class="form-field">
            <label>Cat&eacute;gorie</label>
            <div class="form-categories">
              <button
                v-for="(cat, key) in store.CATEGORIES"
                :key="key"
                class="form-cat-btn"
                :class="{ active: formData.category === key }"
                :style="formData.category === key ? { background: cat.color + '30', color: cat.color, borderColor: cat.color } : {}"
                @click="formData.category = key"
              >
                {{ cat.emoji }} {{ cat.label }}
              </button>
            </div>
          </div>

          <div class="form-field">
            <label>Coordonn&eacute;es</label>
            <div class="form-coords">
              <input v-model.number="formData.lat" type="number" step="0.0001" placeholder="Latitude" />
              <input v-model.number="formData.lng" type="number" step="0.0001" placeholder="Longitude" />
            </div>
          </div>

          <div class="form-field">
            <label>Image (optionnel)</label>
            <input type="file" accept="image/*" @change="onImageChange" ref="imageInput" />
            <div v-if="imagePreview" class="form-image-preview">
              <img :src="imagePreview" alt="Preview" />
              <button class="remove-image-btn" @click="removeImage">&times;</button>
            </div>
          </div>

          <div class="form-field">
            <label>Profil li&eacute; (optionnel)</label>
            <input
              v-model="profileSearch"
              type="text"
              placeholder="Rechercher un profil..."
              @input="searchProfiles"
            />
            <div v-if="profileResults.length > 0" class="profile-results">
              <div
                v-for="p in profileResults"
                :key="p.id"
                class="profile-result-item"
                @click="selectProfile(p)"
              >
                <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="24" />
                <span>{{ p.display_name }}</span>
                <span class="muted">@{{ p.username }}</span>
              </div>
            </div>
            <div v-if="formData.linkedProfile" class="selected-profile">
              <UserAvatar :url="formData.linkedProfile.avatar_url" :name="formData.linkedProfile.display_name" :size="24" />
              <span>{{ formData.linkedProfile.display_name }}</span>
              <button class="remove-profile-btn" @click="formData.linkedProfile = null; formData.linkedProfileId = null">&times;</button>
            </div>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-actions">
            <button class="form-save-btn" @click="handleSave" :disabled="saving">
              {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
            <button class="form-cancel-btn" @click="cancelForm">Annuler</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useMapLocationsStore } from '../stores/mapLocations'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import UserAvatar from '../components/UserAvatar.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const route = useRoute()
const auth = useAuthStore()
const store = useMapLocationsStore()

const mapContainer = ref(null)
const imageInput = ref(null)
let map = null
let markersLayer = null

// Add mode
const addMode = ref(false)

// Form
const showForm = ref(false)
const editingLocation = ref(null)
const saving = ref(false)
const formError = ref('')
const imagePreview = ref(null)
const imageFile = ref(null)
const profileSearch = ref('')
const profileResults = ref([])

const formData = ref({
  name: '',
  description: '',
  category: 'other',
  lat: 0,
  lng: 0,
  linkedProfileId: null,
  linkedProfile: null,
})

// Category helpers
function getCategoryColor(cat) {
  return store.CATEGORIES[cat]?.color || '#8899a6'
}
function getCategoryEmoji(cat) {
  return store.CATEGORIES[cat]?.emoji || '\u{1F4CD}'
}
function getCategoryLabel(cat) {
  return store.CATEGORIES[cat]?.label || 'Autre'
}

// Map init
onMounted(async () => {
  // Init map first so it renders while locations load
  await nextTick()
  initMap()
  try {
    await store.fetchLocations()
    renderMarkers()

    // Navigate to location from query param (e.g. from location mention click)
    if (route.query.location) {
      const targetName = decodeURIComponent(route.query.location)
      const target = store.locations.find(
        l => l.name.toLowerCase() === targetName.toLowerCase()
      )
      if (target) {
        store.selectLocation(target)
        if (map) map.setView([target.lat, target.lng], 16)
      }
    }
  } catch (e) {
    console.error('Failed to load map locations:', e)
  }
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

function initMap() {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    center: [40.6084, -75.4902],
    zoom: 14,
    zoomControl: false,
    attributionControl: false,
  })

  // Dark colored tiles (OSM with CSS dark filter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map)

  // Zoom control top-right
  L.control.zoom({ position: 'topright' }).addTo(map)

  // Discreet attribution
  L.control.attribution({ position: 'bottomright', prefix: false })
    .addAttribution('&copy; <a href="https://carto.com/" style="color:#8899a6">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" style="color:#8899a6">OSM</a>')
    .addTo(map)

  // Markers layer group
  markersLayer = L.layerGroup().addTo(map)

  // Force Leaflet to recalculate container size (fixes blank map)
  setTimeout(() => { if (map) map.invalidateSize() }, 100)
  setTimeout(() => { if (map) map.invalidateSize() }, 500)

  // Also observe container resize
  if (window.ResizeObserver && mapContainer.value) {
    const ro = new ResizeObserver(() => { if (map) map.invalidateSize() })
    ro.observe(mapContainer.value)
  }

  // Map click for add mode
  map.on('click', (e) => {
    if (!addMode.value) return
    openAddForm(e.latlng.lat, e.latlng.lng)
  })
}

function createMarkerIcon(category) {
  const color = getCategoryColor(category)
  const emoji = getCategoryEmoji(category)

  return L.divIcon({
    className: 'map-custom-marker',
    html: `<div class="marker-pin" style="background:${color}; box-shadow: 0 0 14px ${color}80, 0 0 6px ${color}60;">
             <span class="marker-emoji">${emoji}</span>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()

  for (const loc of store.filteredLocations) {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: createMarkerIcon(loc.category),
    })

    marker.bindTooltip(loc.name, {
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    })

    marker.on('click', () => {
      store.selectLocation(loc)
      if (addMode.value) addMode.value = false
    })

    markersLayer.addLayer(marker)
  }
}

// Fetch location posts when a location is selected
watch(() => store.selectedLocation, (loc) => {
  if (loc) {
    store.fetchLocationPosts(loc.id)
  }
})

// Watch filter changes to re-render markers
watch(() => store.filterCategory, () => {
  renderMarkers()
})

// Watch locations changes
watch(() => store.locations, () => {
  renderMarkers()
}, { deep: true })

// Add mode
function toggleAddMode() {
  addMode.value = !addMode.value
  if (addMode.value) {
    store.clearSelection()
    showForm.value = false
  }
}

// Form logic
function openAddForm(lat, lng) {
  editingLocation.value = null
  formData.value = {
    name: '',
    description: '',
    category: 'other',
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    linkedProfileId: null,
    linkedProfile: null,
  }
  imagePreview.value = null
  imageFile.value = null
  profileSearch.value = ''
  profileResults.value = []
  formError.value = ''
  showForm.value = true
  addMode.value = false
}

function startEdit(location) {
  editingLocation.value = location
  formData.value = {
    name: location.name,
    description: location.description || '',
    category: location.category,
    lat: location.lat,
    lng: location.lng,
    linkedProfileId: location.linked_profile?.id || null,
    linkedProfile: location.linked_profile || null,
  }
  imagePreview.value = location.image_url || null
  imageFile.value = null
  profileSearch.value = ''
  profileResults.value = []
  formError.value = ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingLocation.value = null
  formError.value = ''
}

function onImageChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    formError.value = 'Image trop lourde (max 5 Mo)'
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = null
  if (imageInput.value) imageInput.value.value = ''
}

let searchTimeout = null
async function searchProfiles() {
  clearTimeout(searchTimeout)
  const q = profileSearch.value.trim()
  if (!q || q.length < 2) {
    profileResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(5)
    profileResults.value = data || []
  }, 300)
}

function selectProfile(profile) {
  formData.value.linkedProfileId = profile.id
  formData.value.linkedProfile = profile
  profileSearch.value = ''
  profileResults.value = []
}

async function handleSave() {
  formError.value = ''
  if (!formData.value.name.trim()) {
    formError.value = 'Le nom est requis'
    return
  }
  if (!formData.value.lat || !formData.value.lng) {
    formError.value = 'Les coordonnees sont requises'
    return
  }

  saving.value = true
  try {
    if (editingLocation.value) {
      const updated = await store.updateLocation(editingLocation.value.id, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim(),
        category: formData.value.category,
        lat: formData.value.lat,
        lng: formData.value.lng,
        imageFile: imageFile.value,
        linkedProfileId: formData.value.linkedProfileId,
        removeImage: !imagePreview.value && editingLocation.value.image_url,
      })
      store.selectLocation(updated)
    } else {
      const created = await store.createLocation({
        name: formData.value.name.trim(),
        description: formData.value.description.trim(),
        category: formData.value.category,
        lat: formData.value.lat,
        lng: formData.value.lng,
        imageFile: imageFile.value,
        linkedProfileId: formData.value.linkedProfileId,
      })
      store.selectLocation(created)
      // Center map on new location
      if (map) map.panTo([created.lat, created.lng])
    }
    showForm.value = false
    editingLocation.value = null
  } catch (e) {
    formError.value = e.message || 'Erreur lors de la sauvegarde'
  } finally {
    saving.value = false
  }
}

async function handleDelete(location) {
  if (!confirm(`Supprimer "${location.name}" ?`)) return
  try {
    await store.deleteLocation(location.id)
  } catch (e) {
    alert('Erreur: ' + e.message)
  }
}
</script>

<style scoped>
.map-page {
  /* Break out of .container (max-width: 600px) */
  position: fixed;
  top: var(--header-height);
  left: 220px;
  right: 280px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  z-index: 2;
}

/* Toolbar */
.map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.map-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
}

.map-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.add-btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--accent);
  border-radius: 20px;
  background: none;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.add-btn:hover,
.add-btn.active {
  background: var(--accent);
  color: #fff;
}

/* Filters */
.map-filters {
  display: flex;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  overflow-x: auto;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.map-filters::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.filter-chip.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(29, 161, 242, 0.1);
}

.filter-chip:hover {
  border-color: var(--text-secondary);
}

/* Map wrapper */
.map-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
  z-index: 0;
}

.map-container {
  width: 100%;
  height: 100%;
  background: #15202b;
}

.map-container.add-mode {
  cursor: crosshair !important;
}

/* Vignette overlay */
.map-vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  z-index: 5;
}

/* Add mode hint */
.add-mode-hint {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  animation: hint-pulse 2s ease-in-out infinite;
}

@keyframes hint-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Leaflet overrides */
.map-container :deep(.leaflet-tile-pane) {
  filter: brightness(0.7) contrast(1.2) saturate(0.6);
}

.map-container :deep(.leaflet-tile) {
  box-sizing: content-box;
}

.map-container :deep(.leaflet-control-zoom) {
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  overflow: hidden;
}

.map-container :deep(.leaflet-control-zoom a) {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border-color: var(--border) !important;
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
}

.map-container :deep(.leaflet-control-zoom a:hover) {
  background: var(--bg-hover) !important;
}

.map-container :deep(.leaflet-control-attribution) {
  background: rgba(21, 32, 43, 0.8) !important;
  color: var(--text-secondary) !important;
  font-size: 0.65rem !important;
}

.map-container :deep(.leaflet-control-attribution a) {
  color: var(--text-secondary) !important;
}

/* Custom markers (global via deep) */
.map-container :deep(.map-custom-marker) {
  background: none !important;
  border: none !important;
}

.map-container :deep(.marker-pin) {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.map-container :deep(.marker-pin:hover) {
  transform: scale(1.2);
}

.map-container :deep(.marker-emoji) {
  font-size: 16px;
  line-height: 1;
}

/* Tooltip override */
.map-container :deep(.map-tooltip) {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border) !important;
  border-radius: 6px !important;
  padding: 0.3rem 0.6rem !important;
  font-size: 0.8rem !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}

.map-container :deep(.map-tooltip::before) {
  border-top-color: var(--border) !important;
}

/* Detail panel */
.detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  z-index: 20;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-image {
  width: 100%;
  max-height: 200px;
  overflow: hidden;
}

.panel-image img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.panel-body {
  padding: 1rem;
  flex: 1;
}

.panel-header {
  margin-bottom: 0.5rem;
}

.panel-category-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.panel-name {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.panel-desc {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.45;
  margin: 0 0 0.75rem;
  white-space: pre-wrap;
}

.panel-profile-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
  margin-bottom: 0.75rem;
}

.panel-profile-link:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.panel-profile-info {
  display: flex;
  flex-direction: column;
}

.panel-profile-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.panel-profile-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.panel-admin-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.panel-edit-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: none;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
}

.panel-edit-btn:hover {
  background: var(--accent);
  color: #fff;
}

.panel-delete-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--danger);
  border-radius: 8px;
  background: none;
  color: var(--danger);
  font-size: 0.85rem;
  cursor: pointer;
}

.panel-delete-btn:hover {
  background: var(--danger);
  color: #fff;
}

/* Location posts section */
.panel-posts-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.panel-posts-title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.panel-posts-loading,
.panel-posts-empty {
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0.25rem 0;
}

.panel-post-card {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.panel-post-card:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.panel-post-info {
  flex: 1;
  min-width: 0;
}

.panel-post-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.15rem;
}

.panel-post-author {
  font-size: 0.8rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-post-time {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.panel-post-content {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Form overlay */
.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.form-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  width: 100%;
  max-width: 480px;
  max-height: 90%;
  overflow-y: auto;
}

.form-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.form-field {
  margin-bottom: 0.85rem;
}

.form-field label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.form-field input[type="text"],
.form-field input[type="number"],
.form-field textarea {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-field textarea {
  resize: vertical;
  min-height: 60px;
}

.form-field input[type="file"] {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.form-coords {
  display: flex;
  gap: 0.5rem;
}

.form-coords input {
  flex: 1;
}

.form-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.form-cat-btn {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: none;
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.form-image-preview {
  position: relative;
  margin-top: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
  display: inline-block;
}

.form-image-preview img {
  max-width: 100%;
  max-height: 150px;
  display: block;
  border-radius: 8px;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Profile search in form */
.profile-results {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-top: 0.3rem;
  max-height: 150px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.profile-result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.profile-result-item:hover {
  background: var(--bg-hover);
}

.profile-result-item .muted {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.selected-profile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  font-size: 0.85rem;
}

.remove-profile-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.1rem;
}

.form-error {
  color: var(--danger);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.form-save-btn {
  flex: 1;
  padding: 0.55rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}

.form-save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-cancel-btn {
  padding: 0.55rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
}

/* Transitions */
.panel-enter-active,
.panel-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.panel-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Mobile */
@media (max-width: 1100px) {
  .map-page {
    right: 0;
  }
}

@media (max-width: 768px) {
  .map-page {
    left: 0;
    right: 0;
    bottom: 56px;
  }

  .map-toolbar {
    padding: 0.4rem 0.75rem;
  }

  .map-title {
    font-size: 0.9rem;
  }

  .add-btn {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }

  .detail-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 55%;
    border-left: none;
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
  }

  .panel-enter-from,
  .panel-leave-to {
    transform: translateY(100%);
  }

  .form-modal {
    max-width: 100%;
    max-height: 85%;
    border-radius: 12px 12px 0 0;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
  }
}
</style>
