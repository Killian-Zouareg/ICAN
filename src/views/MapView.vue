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
          class="heatmap-btn"
          :class="{ active: showHeatmap }"
          @click="showHeatmap = !showHeatmap"
          title="Heatmap d'activit&eacute;"
        >
          &#x1F525;
        </button>
        <button
          v-if="auth.isAdmin && !drawingZone"
          class="zone-btn"
          @click="startDrawingZone"
          title="Dessiner une zone"
        >
          &#x1F6E1;&#xFE0F; Zone
        </button>
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
      <div ref="mapContainer" class="map-container" :class="{ 'add-mode': addMode || drawingZone }"></div>
      <div class="map-vignette"></div>
    </div>

    <!-- Add mode hint (outside map-wrapper to avoid overflow:hidden clipping) -->
    <div v-if="addMode" class="add-mode-hint">
      Cliquez sur la carte pour placer un lieu
    </div>

    <!-- Zone drawing hint -->
    <div v-if="drawingZone" class="add-mode-hint zone-drawing-hint">
      <span>Cliquez pour tracer la zone ({{ drawingPoints.length }} points)</span>
      <div class="zone-drawing-actions">
        <button v-if="drawingPoints.length >= 3" class="zone-finish-btn" @click="finishDrawing">Terminer</button>
        <button class="zone-cancel-btn" @click="cancelDrawing">Annuler</button>
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

          <!-- Posts linked to this location -->
          <div v-if="selectedLocationPosts.length > 0" class="panel-posts">
            <h4 class="panel-posts-title">
              Posts li&eacute;s
              <span class="panel-posts-count">{{ selectedLocationPosts.length }}</span>
            </h4>
            <router-link
              v-for="post in selectedLocationPosts"
              :key="post.id"
              :to="`/post/${post.id}`"
              class="panel-post-card"
            >
              <UserAvatar
                :url="post.avatar_url"
                :name="post.display_name || post.username || '?'"
                :size="32"
              />
              <div class="panel-post-body">
                <div class="panel-post-meta">
                  <span class="panel-post-author">{{ post.display_name || post.username }}</span>
                  <span class="panel-post-time">{{ timeAgo(post.created_at) }}</span>
                </div>
                <p class="panel-post-text">{{ post.content }}</p>
                <img v-if="post.image_url" :src="post.image_url" class="panel-post-image" />
              </div>
            </router-link>
          </div>

        </div>
      </div>
    </Transition>

    <!-- Zone detail panel -->
    <Transition name="panel">
      <div v-if="selectedZone && !showForm && !showZoneForm" class="detail-panel">
        <button class="panel-close" @click="selectedZone = null">&times;</button>
        <div class="panel-body">
          <div class="panel-header">
            <span
              class="panel-category-badge"
              :style="{ background: (ZONE_STYLES[selectedZone.zone_type]?.color || '#8899a6') + '25', color: ZONE_STYLES[selectedZone.zone_type]?.color || '#8899a6' }"
            >
              &#x1F6E1;&#xFE0F; {{ ZONE_LABELS[selectedZone.zone_type] || selectedZone.zone_type }}
            </span>
          </div>
          <h3 class="panel-name">{{ selectedZone.name }}</h3>
          <p v-if="selectedZone.description" class="panel-desc">{{ selectedZone.description }}</p>
          <div v-if="auth.isAdmin" class="panel-admin-actions">
            <button class="panel-delete-btn" @click="deleteSelectedZone">Supprimer</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Zone creation form -->
    <Teleport to="body">
    <Transition name="panel">
      <div v-if="showZoneForm" class="form-overlay" @click.self="showZoneForm = false">
        <div class="form-modal">
          <h3 class="form-title">Nouvelle zone</h3>
          <div class="form-field">
            <label>Nom</label>
            <input v-model="zoneFormData.name" type="text" maxlength="100" placeholder="Nom de la zone" />
          </div>
          <div class="form-field">
            <label>Type</label>
            <div class="zone-type-grid">
              <button
                v-for="(style, key) in ZONE_STYLES"
                :key="key"
                class="zone-type-btn"
                :class="{ active: zoneFormData.zoneType === key }"
                :style="zoneFormData.zoneType === key ? { background: style.color + '25', color: style.color, borderColor: style.color } : {}"
                @click="zoneFormData.zoneType = key"
              >
                {{ ZONE_LABELS[key] }}
              </button>
            </div>
          </div>
          <div class="form-field">
            <label>Description (optionnel)</label>
            <textarea v-model="zoneFormData.description" rows="2" maxlength="300" placeholder="Description..."></textarea>
          </div>
          <div class="form-actions">
            <button class="form-cancel" @click="showZoneForm = false; drawingPoints = []">Annuler</button>
            <button class="form-save" @click="saveZone" :disabled="!zoneFormData.name.trim()">Cr&eacute;er</button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>

    <!-- Add/Edit Form modal -->
    <Teleport to="body">
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
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useMapLocationsStore } from '../stores/mapLocations'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import UserAvatar from '../components/UserAvatar.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

const route = useRoute()
const auth = useAuthStore()
const store = useMapLocationsStore()

const mapContainer = ref(null)
const imageInput = ref(null)
let map = null
let markersLayer = null
let heatLayer = null
const showHeatmap = ref(false)
let zonesLayer = null

// Zone drawing
const drawingZone = ref(false)
const drawingPoints = ref([])
let drawingPolyline = null
const showZoneForm = ref(false)
const zoneFormData = ref({ name: '', zoneType: 'safe', description: '' })
const selectedZone = ref(null)

const ZONE_STYLES = {
  safe:       { color: '#17bf63', fillColor: '#17bf63', fillOpacity: 0.15, weight: 2, dashArray: null },
  danger:     { color: '#e0245e', fillColor: '#e0245e', fillOpacity: 0.15, weight: 2, dashArray: null },
  neutral:    { color: '#1da1f2', fillColor: '#1da1f2', fillOpacity: 0.1,  weight: 1, dashArray: '6 4' },
  contested:  { color: '#f39c12', fillColor: '#f39c12', fillOpacity: 0.15, weight: 2, dashArray: null },
}

const ZONE_LABELS = {
  safe: 'Safe',
  danger: 'Danger',
  neutral: 'Neutre',
  contested: 'Contest\u00e9',
}

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

const selectedLocationPosts = computed(() => {
  if (!store.selectedLocation) return []
  return store.locationPosts.filter(
    p => p.location_ids?.includes(store.selectedLocation.id)
  )
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

    // Fetch recent posts & zones
    store.fetchRecentLocationPosts()
    store.fetchZones().then(renderZones)

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

  // Map click for add mode or zone drawing
  map.on('click', (e) => {
    if (drawingZone.value) {
      addDrawingPoint(e.latlng)
      return
    }
    if (!addMode.value) return
    openAddForm(e.latlng.lat, e.latlng.lng)
  })
}

// Build a map of locationId -> posts[] for badge counts + hover tooltips
function getPostsByLocation() {
  const map = {}
  for (const post of store.locationPosts) {
    if (!post.location_ids?.length) continue
    for (const locId of post.location_ids) {
      if (!map[locId]) map[locId] = []
      map[locId].push(post)
    }
  }
  return map
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getPulseClass(postCount) {
  if (postCount >= 6) return 'pulse-high'
  if (postCount >= 3) return 'pulse-mid'
  if (postCount >= 1) return 'pulse-low'
  return ''
}

function createMarkerIcon(category, postCount) {
  const color = getCategoryColor(category)
  const emoji = getCategoryEmoji(category)
  const badgeHtml = postCount > 0
    ? `<span class="marker-badge">${postCount}</span>`
    : ''
  const pulseClass = getPulseClass(postCount)

  return L.divIcon({
    className: 'map-custom-marker',
    html: `<div class="marker-pin ${pulseClass}" style="background:${color}; box-shadow: 0 0 14px ${color}80, 0 0 6px ${color}60;" data-color="${color}">
             <span class="marker-emoji">${emoji}</span>
             ${badgeHtml}
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function buildPostsTooltipHtml(posts) {
  const items = posts.slice(0, 5).map(post => {
    const displayName = escapeHtml(post.display_name || post.username || '?')
    const content = escapeHtml((post.content || '').slice(0, 200)) + (post.content?.length > 200 ? '...' : '')
    const ago = timeAgo(post.created_at)
    const initials = (post.display_name || post.username || '?').slice(0, 2).toUpperCase()
    const avatarHtml = post.avatar_url
      ? `<img src="${post.avatar_url}" class="loc-post-avatar" />`
      : `<div class="loc-post-avatar loc-post-avatar-fallback">${initials}</div>`

    return `<a href="#/post/${post.id}" class="loc-post-item">
      ${avatarHtml}
      <div class="loc-post-body">
        <div class="loc-post-meta">
          <span class="loc-post-author">${displayName}</span>
          <span class="loc-post-time">${ago}</span>
        </div>
        <div class="loc-post-text">${content}</div>
      </div>
    </a>`
  }).join('')

  const moreHtml = posts.length > 5
    ? `<div class="loc-post-more">+ ${posts.length - 5} autre${posts.length - 5 > 1 ? 's' : ''}</div>`
    : ''

  return `<div class="loc-posts-list">${items}${moreHtml}</div>`
}

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()

  const postsByLoc = getPostsByLocation()

  for (const loc of store.filteredLocations) {
    const locPosts = postsByLoc[loc.id] || []
    const marker = L.marker([loc.lat, loc.lng], {
      icon: createMarkerIcon(loc.category, locPosts.length),
    })

    if (locPosts.length > 0) {
      const tooltipContent = `<div class="loc-tooltip-name">${escapeHtml(loc.name)}</div>${buildPostsTooltipHtml(locPosts)}`
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -20],
        className: 'map-tooltip-posts',
        interactive: true,
        sticky: false,
      })
    } else {
      marker.bindTooltip(loc.name, {
        direction: 'top',
        offset: [0, -20],
        className: 'map-tooltip',
      })
    }

    marker.on('click', () => {
      store.selectLocation(loc)
      if (addMode.value) addMode.value = false
    })

    markersLayer.addLayer(marker)
  }
}

// Re-render markers when posts load (to update badges + tooltips)
watch(() => store.locationPosts, () => {
  renderMarkers()
}, { deep: true })

// Watch filter changes to re-render markers
watch(() => store.filterCategory, () => {
  renderMarkers()
})

// Watch locations changes
watch(() => store.locations, () => {
  renderMarkers()
}, { deep: true })

// Heatmap
function updateHeatmap() {
  if (!map) return
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null }
  if (!showHeatmap.value) return

  const postsByLoc = getPostsByLocation()
  const heatData = []
  for (const loc of store.locations) {
    const count = (postsByLoc[loc.id] || []).length
    if (count > 0) heatData.push([loc.lat, loc.lng, count])
  }
  if (heatData.length === 0) return

  heatLayer = L.heatLayer(heatData, {
    radius: 35,
    blur: 25,
    maxZoom: 17,
    gradient: { 0.2: '#1da1f2', 0.5: '#17bf63', 0.8: '#FFD700', 1.0: '#e0245e' },
  })
  heatLayer.addTo(map)
}

watch(showHeatmap, updateHeatmap)
watch(() => store.locationPosts, updateHeatmap, { deep: true })

// Zones rendering
function renderZones() {
  if (!map) return
  if (zonesLayer) { map.removeLayer(zonesLayer); zonesLayer = null }
  if (store.zones.length === 0) return

  zonesLayer = L.layerGroup()
  for (const zone of store.zones) {
    const style = ZONE_STYLES[zone.zone_type] || ZONE_STYLES.neutral
    const polygon = L.polygon(zone.coordinates, { ...style })
    polygon.bindTooltip(zone.name, { className: 'map-tooltip', sticky: true })
    polygon.on('click', () => {
      selectedZone.value = zone
      store.clearSelection()
    })
    zonesLayer.addLayer(polygon)
  }
  zonesLayer.addTo(map)
}

watch(() => store.zones, renderZones, { deep: true })

// Zone drawing tool
function startDrawingZone() {
  drawingZone.value = true
  drawingPoints.value = []
  selectedZone.value = null
  store.clearSelection()
  showForm.value = false
  addMode.value = false
}

function cancelDrawing() {
  drawingZone.value = false
  drawingPoints.value = []
  if (drawingPolyline) { map.removeLayer(drawingPolyline); drawingPolyline = null }
}

function addDrawingPoint(latlng) {
  drawingPoints.value.push([latlng.lat, latlng.lng])
  if (drawingPolyline) map.removeLayer(drawingPolyline)
  if (drawingPoints.value.length >= 2) {
    drawingPolyline = L.polygon(drawingPoints.value, {
      color: '#1da1f2', fillOpacity: 0.1, weight: 2, dashArray: '6 4',
    }).addTo(map)
  }
}

function finishDrawing() {
  if (drawingPoints.value.length < 3) return
  if (drawingPolyline) { map.removeLayer(drawingPolyline); drawingPolyline = null }
  drawingZone.value = false
  zoneFormData.value = { name: '', zoneType: 'safe', description: '' }
  showZoneForm.value = true
}

async function saveZone() {
  if (!zoneFormData.value.name.trim()) return
  try {
    await store.createZone({
      name: zoneFormData.value.name.trim(),
      zoneType: zoneFormData.value.zoneType,
      coordinates: drawingPoints.value,
      description: zoneFormData.value.description.trim(),
    })
    showZoneForm.value = false
    drawingPoints.value = []
  } catch (e) {
    alert('Erreur: ' + e.message)
  }
}

async function deleteSelectedZone() {
  if (!selectedZone.value || !confirm(`Supprimer la zone "${selectedZone.value.name}" ?`)) return
  try {
    await store.deleteZone(selectedZone.value.id)
    selectedZone.value = null
  } catch (e) {
    alert('Erreur: ' + e.message)
  }
}

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
  overflow: visible;
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

.map-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.heatmap-btn {
  width: 34px; height: 34px;
  border: 1px solid var(--border); border-radius: 50%;
  background: none; color: var(--text-secondary);
  font-size: 1rem; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.heatmap-btn:hover { border-color: #e0245e; background: rgba(224,36,94,0.1); }
.heatmap-btn.active { border-color: #e0245e; background: rgba(224,36,94,0.2); box-shadow: 0 0 8px rgba(224,36,94,0.3); }

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

/* Zone drawing */
.zone-drawing-hint {
  display: flex; align-items: center; gap: 0.75rem;
  animation: none;
  background: #9b59b6;
}
.zone-drawing-actions {
  display: flex; gap: 0.35rem;
}
.zone-finish-btn, .zone-cancel-btn {
  padding: 0.25rem 0.65rem; border-radius: 12px; border: none;
  font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit;
}
.zone-finish-btn { background: #fff; color: #9b59b6; }
.zone-cancel-btn { background: rgba(255,255,255,0.2); color: #fff; }

.zone-btn {
  padding: 0.35rem 0.75rem; border: 1px solid #9b59b6; border-radius: 20px;
  background: none; color: #9b59b6; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.zone-btn:hover { background: #9b59b6; color: #fff; }

.zone-type-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.35rem;
}
.zone-type-btn {
  padding: 0.45rem 0.5rem; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-primary); color: var(--text-secondary); cursor: pointer;
  font-size: 0.82rem; font-family: inherit; transition: all 0.15s; font-weight: 600;
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

/* Pulse animations for active markers */
.map-container :deep(.marker-pin.pulse-low),
.map-container :deep(.marker-pin.pulse-mid),
.map-container :deep(.marker-pin.pulse-high) {
  position: relative;
}

.map-container :deep(.marker-pin.pulse-low::after),
.map-container :deep(.marker-pin.pulse-mid::after),
.map-container :deep(.marker-pin.pulse-high::after) {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: inherit;
  z-index: -1;
  animation: marker-pulse var(--pulse-duration) ease-out infinite;
  opacity: 0;
}

.map-container :deep(.marker-pin.pulse-low) { --pulse-duration: 3s; }
.map-container :deep(.marker-pin.pulse-mid) { --pulse-duration: 2s; }
.map-container :deep(.marker-pin.pulse-high) { --pulse-duration: 1.2s; }

@keyframes marker-pulse {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
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

/* Post count badge on location marker */
.map-container :deep(.marker-badge) {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  padding: 0 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

/* Tooltip with posts list */
.map-container :deep(.map-tooltip-posts) {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 0 !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5) !important;
  color: var(--text-primary) !important;
  max-width: 380px !important;
  width: 360px;
}

.map-container :deep(.map-tooltip-posts::before) {
  border-top-color: var(--border) !important;
}

.map-container :deep(.loc-tooltip-name) {
  padding: 0.55rem 0.75rem;
  font-weight: 700;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);
}

.map-container :deep(.loc-posts-list) {
  display: flex;
  flex-direction: column;
  max-height: 400px;
  overflow-y: auto;
}

.map-container :deep(.loc-post-item) {
  display: flex;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  text-decoration: none;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  transition: background 0.12s;
  cursor: pointer;
}

.map-container :deep(.loc-post-item:last-child) {
  border-bottom: none;
}

.map-container :deep(.loc-post-item:hover) {
  background: var(--bg-hover);
  text-decoration: none;
}

.map-container :deep(.loc-post-avatar) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.map-container :deep(.loc-post-avatar-fallback) {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
}

.map-container :deep(.loc-post-body) {
  flex: 1;
  min-width: 0;
}

.map-container :deep(.loc-post-meta) {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.15rem;
}

.map-container :deep(.loc-post-author) {
  font-size: 0.78rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.map-container :deep(.loc-post-time) {
  font-size: 0.65rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.map-container :deep(.loc-post-text) {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.map-container :deep(.loc-post-more) {
  text-align: center;
  padding: 0.4rem;
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 600;
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

/* Panel posts */
.panel-posts {
  margin-top: 1rem;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

.panel-posts-title {
  font-size: 0.88rem;
  font-weight: 700;
  margin: 0 0 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.panel-posts-count {
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  padding: 0 5px;
}

.panel-post-card {
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem;
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.12s;
  margin-bottom: 0.25rem;
}

.panel-post-card:hover {
  background: var(--bg-hover);
  text-decoration: none;
}

.panel-post-body {
  flex: 1;
  min-width: 0;
}

.panel-post-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.2rem;
}

.panel-post-author {
  font-size: 0.82rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.panel-post-time {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.panel-post-text {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
  white-space: pre-wrap;
}

.panel-post-image {
  max-width: 100%;
  max-height: 140px;
  border-radius: 8px;
  margin-top: 0.4rem;
  object-fit: cover;
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
