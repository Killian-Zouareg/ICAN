<template>
  <div class="map-page">
    <!-- Toolbar -->
    <div class="map-toolbar">
      <div class="map-toolbar-left">
        <button @click="$router.back()" class="back-btn">&larr;</button>
        <h2 class="map-title">Carte d'Allentown</h2>
      </div>
      <div class="map-toolbar-right">
        <a
          class="webcam-btn"
          href="https://www.fox29.com/allentown-webcam"
          target="_blank"
          rel="noopener noreferrer"
          title="Webcam d'Allentown en direct"
        >
          &#x1F4F9; Webcam
        </a>
        <button
          class="heatmap-btn"
          :class="{ active: showHeatmap }"
          @click="showHeatmap = !showHeatmap"
          title="Heatmap d'activit&eacute;"
        >
          &#x1F525;
        </button>
        <button
          class="token-btn"
          :class="{ active: placeTokenMode }"
          @click="toggleTokenPlaceMode"
          :title="tokenStore.myToken ? 'Déplacer mon token' : 'Placer mon token'"
        >
          {{ placeTokenMode ? '✖ Annuler' : (tokenStore.myToken ? '\u{1F3AF} Déplacer' : '\u{1F3AF} Mon token') }}
        </button>
        <button
          v-if="tokenStore.myActiveShares.length > 0"
          class="token-stop-btn"
          @click="stopMyShares"
          :title="`Arrêter mes partages (${tokenStore.myActiveShares.length})`"
        >
          &#x23F9;&#xFE0F; Arrêter partage ({{ tokenStore.myActiveShares.length }})
        </button>
        <button
          v-if="auth.isAdmin && !drawingZone"
          class="zone-btn"
          @click="startDrawingZone"
          title="Ajouter une zone"
        >
          &#x1F6E1;&#xFE0F; Ajouter une zone
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
      <div
        v-for="(cat, key) in store.CATEGORIES"
        :key="key"
        class="filter-chip-wrapper"
        @mouseenter="showCategoryDropdown(key, $event)"
        @mouseleave="scheduleCategoryDropdownHide"
      >
        <button
          class="filter-chip"
          :class="{ active: store.filterCategory === key }"
          :style="store.filterCategory === key ? { background: cat.color + '30', color: cat.color, borderColor: cat.color } : {}"
          @click="store.filterCategory = store.filterCategory === key ? null : key"
        >
          {{ cat.emoji }} {{ cat.label }}
        </button>
        <Teleport to="body">
          <Transition name="dropdown">
            <div
              v-if="hoveredCategory === key"
              class="filter-dropdown"
              :style="dropdownStyle"
              @mouseenter="cancelCategoryDropdownHide"
              @mouseleave="scheduleCategoryDropdownHide"
            >
              <div
                v-for="loc in locationsByCategory(key)"
                :key="loc.id"
                class="filter-dropdown-item"
                @click="flyToLocation(loc)"
              >
                {{ cat.emoji }} {{ loc.name }}
              </div>
              <div v-if="locationsByCategory(key).length === 0" class="filter-dropdown-empty">
                Aucun lieu
              </div>
            </div>
          </Transition>
        </Teleport>
      </div>
      <div
        class="filter-chip-wrapper"
        @mouseenter="showZonesDropdown($event)"
        @mouseleave="scheduleZonesDropdownHide"
      >
        <button class="filter-chip zones-chip" :class="{ active: zonesDropdownOpen }">
          &#x1F6E1;&#xFE0F; Zones
        </button>
        <Teleport to="body">
          <Transition name="dropdown">
            <div
              v-if="zonesDropdownOpen"
              class="filter-dropdown zones-dropdown"
              :style="zonesDropdownStyle"
              @mouseenter="cancelZonesDropdownHide"
              @mouseleave="scheduleZonesDropdownHide"
            >
              <template v-for="(label, type) in ZONE_LABELS" :key="type">
                <div class="zones-dropdown-section-title" :style="{ color: ZONE_STYLES[type].color }">
                  {{ ZONE_STYLES[type].emoji }} {{ label }}
                </div>
                <div
                  v-for="zone in zonesByType(type)"
                  :key="zone.id"
                  class="filter-dropdown-item"
                  @click="flyToZone(zone)"
                >
                  <span
                    class="zone-dot"
                    :style="{ background: ZONE_STYLES[zone.zone_type].color }"
                  ></span>
                  {{ zone.name }}
                </div>
                <div v-if="zonesByType(type).length === 0" class="filter-dropdown-empty">
                  Aucune zone
                </div>
              </template>
            </div>
          </Transition>
        </Teleport>
      </div>
    </div>

    <!-- Map container -->
    <div class="map-wrapper">
      <div
        ref="mapContainer"
        class="map-container"
        :class="{ 'add-mode': addMode || drawingZone || placeTokenMode }"
        :style="weatherTileStyle"
      ></div>
      <WeatherOverlay class="map-weather-overlay" />
      <div class="map-vignette"></div>
      <!-- Long-press progress indicator -->
      <div
        v-if="longPressActive"
        class="long-press-indicator"
        :style="{ left: longPressPos.x + 'px', top: longPressPos.y + 'px' }"
      >
        <svg viewBox="0 0 36 36">
          <circle class="lp-track" cx="18" cy="18" r="16" />
          <circle class="lp-fill" cx="18" cy="18" r="16" />
        </svg>
        <span class="lp-emoji">&#x1F4DD;</span>
      </div>
    </div>

    <!-- Add mode hint (outside map-wrapper to avoid overflow:hidden clipping) -->
    <div v-if="addMode" class="add-mode-hint">
      Cliquez sur la carte pour placer un lieu
    </div>
    <div v-if="placeTokenMode" class="add-mode-hint">
      Cliquez sur la carte pour {{ tokenStore.myToken ? 'déplacer' : 'placer' }} ton token
    </div>

    <!-- Post-from-map confirmation modal -->
    <Transition name="modal">
      <div v-if="postHerePicked" class="post-here-overlay" @click.self="cancelPostHere">
        <div class="post-here-modal">
          <h3 class="post-here-title">Cr&eacute;er un post depuis ce lieu</h3>
          <p class="post-here-coords">
            &#x1F4CD; {{ postHerePicked.lat.toFixed(5) }}, {{ postHerePicked.lng.toFixed(5) }}
          </p>
          <label class="post-here-label">
            Nom du lieu (visible dans le post)
            <input
              v-model="postHereLabel"
              type="text"
              maxlength="80"
              placeholder="Ex. &Eacute;cole de police"
              @keydown.enter="confirmPostHere"
            />
          </label>
          <div class="post-here-actions">
            <button class="post-here-cancel" @click="cancelPostHere">Annuler</button>
            <button class="post-here-validate" :disabled="!postHereLabel.trim()" @click="confirmPostHere">
              Valider
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useMapLocationsStore } from '../stores/mapLocations'
import { useUserTokenStore } from '../stores/userToken'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import UserAvatar from '../components/UserAvatar.vue'
import WeatherOverlay from '../components/WeatherOverlay.vue'
import { useWeatherEffects } from '../composables/useWeatherEffects'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

// Weather effects: tile filter + overlay
const { tileFilter } = useWeatherEffects()
const weatherTileStyle = computed(() => {
  if (!tileFilter.value) return {}
  return { '--map-weather-filter': tileFilter.value }
})

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useMapLocationsStore()
const tokenStore = useUserTokenStore()

// --- Personal token + shared tokens ---
const placeTokenMode = ref(false)
let tokenLayer = null
const tokenMarkers = new Map() // owner_id -> L.marker

function toggleTokenPlaceMode() {
  placeTokenMode.value = !placeTokenMode.value
  if (placeTokenMode.value) {
    addMode.value = false
    if (drawingZone.value) cancelDrawing()
  }
}

function buildTokenIcon({ profile, isMine, isActive }) {
  const avatar = profile?.avatar_url
  const initials = (profile?.display_name || profile?.username || '?').slice(0, 2).toUpperCase()
  const inner = avatar
    ? `<img src="${avatar}" alt="" />`
    : `<span class="map-token-initials">${initials}</span>`
  let cls = 'map-token-marker'
  if (isMine) cls += ' mine'
  if (isActive) cls += ' active'
  return L.divIcon({
    className: 'map-token-icon',
    html: `<div class="${cls}">${inner}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  })
}

function renderTokens() {
  if (!map) return
  if (!tokenLayer) {
    tokenLayer = L.layerGroup().addTo(map)
  }
  const myProfileId = auth.activeProfile?.id

  // Build the set of owner_ids to display: me + any owner with an active share
  const visibleOwners = new Map() // owner_id -> { isMine, profile }
  if (myProfileId && tokenStore.getTokenForOwner(myProfileId)) {
    visibleOwners.set(myProfileId, { isMine: true, profile: auth.activeProfile })
  }
  for (const s of tokenStore.activeShares) {
    if (!visibleOwners.has(s.owner_id)) {
      visibleOwners.set(s.owner_id, { isMine: s.owner_id === myProfileId, profile: s.owner })
    }
  }

  // Remove markers no longer visible
  for (const [ownerId, marker] of tokenMarkers) {
    if (!visibleOwners.has(ownerId)) {
      tokenLayer.removeLayer(marker)
      tokenMarkers.delete(ownerId)
    }
  }

  // Add / update markers
  for (const [ownerId, info] of visibleOwners) {
    const tok = tokenStore.getTokenForOwner(ownerId)
    if (!tok) continue
    const isActive = ownerId !== myProfileId || tokenStore.myActiveShares.length > 0
    const icon = buildTokenIcon({ profile: info.profile, isMine: info.isMine, isActive })
    const latlng = [tok.lat, tok.lng]
    let marker = tokenMarkers.get(ownerId)
    if (!marker) {
      marker = L.marker(latlng, { icon, zIndexOffset: 500 })
      bindTokenPopup(marker, ownerId, info)
      tokenLayer.addLayer(marker)
      tokenMarkers.set(ownerId, marker)
    } else {
      marker.setLatLng(latlng)
      marker.setIcon(icon)
    }
  }
}

function bindTokenPopup(marker, ownerId, info) {
  marker.on('click', () => {
    const tok = tokenStore.getTokenForOwner(ownerId)
    const isMine = info.isMine
    const shares = [...tokenStore.activeShares].filter((s) => s.owner_id === ownerId)
    const profile = info.profile
    const name = escapeHtml(profile?.display_name || profile?.username || '?')
    const handle = profile?.username ? `@${escapeHtml(profile.username)}` : ''
    let body
    if (isMine) {
      const activeCount = shares.length
      body = activeCount > 0
        ? `<div class="map-token-popup-status">Partagé · ${activeCount} actif${activeCount > 1 ? 's' : ''}</div>`
        : `<div class="map-token-popup-status muted">Visible par vous uniquement</div>`
    } else {
      const s = shares[0]
      const remainMs = s ? new Date(s.expires_at).getTime() - Date.now() : 0
      const remainMin = Math.max(0, Math.round(remainMs / 60000))
      body = `<div class="map-token-popup-status">Partage en direct · expire dans ${remainMin} min</div>`
    }
    const html = `
      <div class="map-token-popup">
        <div class="map-token-popup-name">${name}</div>
        ${handle ? `<div class="map-token-popup-handle">${handle}</div>` : ''}
        ${body}
        ${tok ? `<div class="map-token-popup-coords">${tok.lat.toFixed(5)}, ${tok.lng.toFixed(5)}</div>` : ''}
      </div>
    `
    marker.bindPopup(html, { className: 'map-token-popup-wrap' }).openPopup()
  })
}

async function handleTokenPlaceClick(latlng) {
  try {
    await tokenStore.placeToken(latlng.lat, latlng.lng)
    placeTokenMode.value = false
    renderTokens()
  } catch (e) {
    alert('Erreur: ' + (e.message || e))
  }
}

async function stopMyShares() {
  if (!confirm('Arrêter tous tes partages de position en cours ?')) return
  for (const s of [...tokenStore.myActiveShares]) {
    try { await tokenStore.stopShare(s.id) } catch (_) {}
  }
}

// --- Post-from-map (long-press) ---
const postHerePicked = ref(null) // { lat, lng } | null
const postHereLabel = ref('')

const LONG_PRESS_MS = 600
const longPressActive = ref(false)
const longPressPos = ref({ x: 0, y: 0 })
let longPressTimer = null
let longPressStart = null
let longPressLatLng = null

function pickPostHerePoint(lat, lng) {
  postHerePicked.value = { lat, lng }
  postHereLabel.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function cancelPostHere() {
  postHerePicked.value = null
  postHereLabel.value = ''
}

function confirmPostHere() {
  const picked = postHerePicked.value
  const label = postHereLabel.value.trim()
  if (!picked || !label) return
  router.push({
    path: '/',
    query: {
      postLat: picked.lat.toFixed(6),
      postLng: picked.lng.toFixed(6),
      postLabel: label,
    },
  })
}

function dropTransientPin(lat, lng, label) {
  if (!map) return
  const safe = (label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div class="post-target-pin"><span class="ptp-emoji">\u{1F4CD}</span>${safe ? `<span class="ptp-label">${safe}</span>` : ''}</div>`
  const icon = L.divIcon({ className: 'post-target-pin-icon', html, iconSize: null })
  const m = L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(map)
  setTimeout(() => { try { map.removeLayer(m) } catch (_) { /* noop */ } }, 10000)
}

function isInteractiveMapTarget(target) {
  if (!target || !target.closest) return false
  // Block long-press on markers / popups / controls — but ALLOW it on zone polygons
  // (which carry `.leaflet-interactive`). Zone polygons are SVG <path>; markers are not.
  if (target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control, .marker-cluster, .custom-marker')) {
    return true
  }
  return false
}

let suppressClickUntil = 0
function onMapClickCapture(ev) {
  if (Date.now() < suppressClickUntil) {
    ev.stopPropagation()
    ev.preventDefault()
    suppressClickUntil = 0
  }
}

function clearLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = null
  longPressStart = null
  longPressLatLng = null
  longPressActive.value = false
}

function onMapPointerDown(ev) {
  // Left button / primary touch only
  if (ev.button !== undefined && ev.button !== 0) return
  if (addMode.value || drawingZone.value) return
  if (postHerePicked.value) return // modal already open
  if (isInteractiveMapTarget(ev.target)) return
  if (!map) return

  longPressStart = { x: ev.clientX, y: ev.clientY }
  longPressLatLng = map.mouseEventToLatLng(ev)
  longPressPos.value = {
    x: ev.clientX - (mapContainer.value?.getBoundingClientRect().left || 0),
    y: ev.clientY - (mapContainer.value?.getBoundingClientRect().top || 0),
  }
  longPressActive.value = true
  longPressTimer = setTimeout(() => {
    if (longPressLatLng) {
      pickPostHerePoint(longPressLatLng.lat, longPressLatLng.lng)
      // Suppress the click that will fire on pointerup so a long-press
      // inside a zone doesn't also open the zone detail panel.
      suppressClickUntil = Date.now() + 500
    }
    clearLongPress()
  }, LONG_PRESS_MS)
}

function onMapPointerMove(ev) {
  if (!longPressStart) return
  const dx = ev.clientX - longPressStart.x
  const dy = ev.clientY - longPressStart.y
  if (Math.hypot(dx, dy) > 8) clearLongPress()
}

function onMapPointerUp() {
  clearLongPress()
}

const mapContainer = ref(null)
const imageInput = ref(null)
let map = null
let markersLayer = null
let heatLayer = null
const showHeatmap = ref(true)
let zonesLayer = null

// Clustering
const CLUSTER_PIXEL_THRESHOLD = 50
let expandedCluster = null
let expandedMarkers = []
let clusterData = []
let collapseTimeout = null
let renderMarkersTimer = null

// Filter dropdown
const hoveredCategory = ref(null)
const dropdownStyle = ref({})
let dropdownHideTimeout = null

// Zone drawing
const drawingZone = ref(false)
const drawingPoints = ref([])
let drawingPolyline = null
const showZoneForm = ref(false)
const zoneFormData = ref({ name: '', zoneType: 'safe', description: '' })
const selectedZone = ref(null)

const ZONE_STYLES = {
  safe:       { color: '#17bf63', fillColor: '#17bf63', fillOpacity: 0.25, weight: 3, dashArray: null, emoji: '\u{1F6E1}\u{FE0F}' },
  danger:     { color: '#e0245e', fillColor: '#e0245e', fillOpacity: 0.28, weight: 3, dashArray: null, emoji: '\u{26A0}\u{FE0F}' },
  neutral:    { color: '#1da1f2', fillColor: '#1da1f2', fillOpacity: 0.20, weight: 2, dashArray: '6 4', emoji: '\u{1F535}' },
  contested:  { color: '#f39c12', fillColor: '#f39c12', fillOpacity: 0.25, weight: 3, dashArray: '4 4', emoji: '\u{2694}\u{FE0F}' },
}

const ZONE_LABELS = {
  safe: 'Safe',
  danger: 'Danger',
  neutral: 'Neutre',
  contested: 'Contest\u00e9',
}

function zoneCentroid(coords) {
  let lat = 0, lng = 0
  for (const c of coords) { lat += c[0]; lng += c[1] }
  return [lat / coords.length, lng / coords.length]
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

    // Personal token + active shares (already kept fresh by App.vue Realtime channel)
    await tokenStore.fetchMyToken()
    await tokenStore.fetchActiveShares()
    renderTokens()

    // ?share=<id> deep link
    if (route.query.share) {
      const shareId = String(route.query.share)
      const s = await tokenStore.ensureShare(shareId)
      if (s) {
        const tok = tokenStore.getTokenForOwner(s.owner_id)
        if (tok && map) map.flyTo([tok.lat, tok.lng], 16, { duration: 0.8 })
      }
    }

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
    } else if (route.query.lat && route.query.lng) {
      // From a "📍 Label (lat, lng)" mention inside a post
      const lat = Number(route.query.lat)
      const lng = Number(route.query.lng)
      const label = route.query.label ? decodeURIComponent(route.query.label) : ''
      if (Number.isFinite(lat) && Number.isFinite(lng) && map) {
        map.setView([lat, lng], 16)
        dropTransientPin(lat, lng, label)
      }
    }
  } catch (e) {
    console.error('Failed to load map locations:', e)
  }
})

onUnmounted(() => {
  clearLongPress()
  const el = mapContainer.value
  if (el) {
    el.removeEventListener('pointerdown', onMapPointerDown)
    el.removeEventListener('pointermove', onMapPointerMove)
    el.removeEventListener('pointerup', onMapPointerUp)
    el.removeEventListener('pointercancel', onMapPointerUp)
    el.removeEventListener('pointerleave', onMapPointerUp)
    el.removeEventListener('click', onMapClickCapture, true)
  }
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

  // Map click for add mode, zone drawing, or token placement
  map.on('click', (e) => {
    if (placeTokenMode.value) {
      handleTokenPlaceClick(e.latlng)
      return
    }
    if (drawingZone.value) {
      addDrawingPoint(e.latlng)
      return
    }
    if (!addMode.value) return
    openAddForm(e.latlng.lat, e.latlng.lng)
  })

  // Long-press on map background / zones -> open "post from here" modal
  const el = mapContainer.value
  if (el) {
    el.addEventListener('pointerdown', onMapPointerDown)
    el.addEventListener('pointermove', onMapPointerMove)
    el.addEventListener('pointerup', onMapPointerUp)
    el.addEventListener('pointercancel', onMapPointerUp)
    el.addEventListener('pointerleave', onMapPointerUp)
    el.addEventListener('click', onMapClickCapture, true)
  }

  // Recalculate clusters on zoom/pan
  map.on('zoomend', debouncedRenderMarkers)
  map.on('moveend', debouncedRenderMarkers)
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

// --- Clustering helpers ---

function computeClusters(locations) {
  if (!map || locations.length === 0) return []

  const assigned = new Set()
  const clusters = []

  for (let i = 0; i < locations.length; i++) {
    if (assigned.has(i)) continue
    const group = [locations[i]]
    assigned.add(i)
    const pixA = map.latLngToContainerPoint([locations[i].lat, locations[i].lng])

    for (let j = i + 1; j < locations.length; j++) {
      if (assigned.has(j)) continue
      const pixB = map.latLngToContainerPoint([locations[j].lat, locations[j].lng])
      const dist = Math.sqrt((pixA.x - pixB.x) ** 2 + (pixA.y - pixB.y) ** 2)
      if (dist < CLUSTER_PIXEL_THRESHOLD) {
        group.push(locations[j])
        assigned.add(j)
      }
    }

    const avgLat = group.reduce((s, l) => s + l.lat, 0) / group.length
    const avgLng = group.reduce((s, l) => s + l.lng, 0) / group.length
    clusters.push({ locations: group, center: { lat: avgLat, lng: avgLng } })
  }
  return clusters
}

function getDominantColor(locations) {
  const freq = {}
  for (const loc of locations) {
    freq[loc.category] = (freq[loc.category] || 0) + 1
  }
  let maxCat = locations[0].category
  for (const cat in freq) {
    if (freq[cat] > (freq[maxCat] || 0)) maxCat = cat
  }
  return getCategoryColor(maxCat)
}

function createClusterIcon(count, dominantColor) {
  return L.divIcon({
    className: 'map-custom-marker',
    html: `<div class="cluster-bubble" style="background:${dominantColor}; box-shadow: 0 0 14px ${dominantColor}80, 0 0 6px ${dominantColor}60;">
             <span class="cluster-count">${count}</span>
           </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function bindMarkerTooltipAndClick(marker, loc, locPosts) {
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
}

function expandCluster(entry, postsByLoc) {
  if (expandedCluster === entry) return
  collapseExpandedCluster()

  expandedCluster = entry
  entry.marker.setOpacity(0)

  const count = entry.locations.length
  const radius = Math.max(40, count * 14)
  const centerLatLng = L.latLng(entry.center.lat, entry.center.lng)
  const centerPx = map.latLngToContainerPoint(centerLatLng)

  expandedMarkers = entry.locations.map((loc, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const targetPx = L.point(
      centerPx.x + radius * Math.cos(angle),
      centerPx.y + radius * Math.sin(angle)
    )
    const targetLatLng = map.containerPointToLatLng(targetPx)

    const locPosts = postsByLoc[loc.id] || []
    const m = L.marker([entry.center.lat, entry.center.lng], {
      icon: createMarkerIcon(loc.category, locPosts.length),
      zIndexOffset: 1000,
    })

    bindMarkerTooltipAndClick(m, loc, locPosts)
    markersLayer.addLayer(m)

    const el = m.getElement()
    if (el) {
      // Disable pointer events during animation to avoid spurious mouseout
      el.style.pointerEvents = 'none'
      el.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
    requestAnimationFrame(() => {
      m.setLatLng(targetLatLng)
    })

    return m
  })

  // Wait for animation to finish before activating collapse listeners
  setTimeout(() => {
    if (expandedCluster !== entry) return // already collapsed
    for (const m of expandedMarkers) {
      const el = m.getElement()
      if (el) el.style.pointerEvents = ''
    }
    setupCollapseListener(entry)
  }, 400)
}

function setupCollapseListener(entry) {
  const scheduleCollapse = () => {
    collapseTimeout = setTimeout(() => {
      collapseExpandedCluster()
    }, 300)
  }

  for (const m of expandedMarkers) {
    m.on('mouseover', () => { clearTimeout(collapseTimeout) })
    m.on('mouseout', scheduleCollapse)
  }

  // Track cluster marker mouseout too (it's transparent but still emits events)
  entry._collapseHandler = scheduleCollapse
  entry.marker.on('mouseout', scheduleCollapse)
}

function collapseExpandedCluster() {
  clearTimeout(collapseTimeout)
  if (!expandedCluster) return

  // Clean up the mouseout listener on the cluster marker
  if (expandedCluster._collapseHandler) {
    expandedCluster.marker.off('mouseout', expandedCluster._collapseHandler)
    expandedCluster._collapseHandler = null
  }

  for (const m of expandedMarkers) {
    markersLayer.removeLayer(m)
  }
  expandedMarkers = []

  expandedCluster.marker.setOpacity(1)
  expandedCluster = null
}

function debouncedRenderMarkers() {
  clearTimeout(renderMarkersTimer)
  renderMarkersTimer = setTimeout(renderMarkers, 150)
}

// --- Filter dropdown helpers ---

function locationsByCategory(catKey) {
  return store.locations.filter(l => l.category === catKey).sort((a, b) => a.name.localeCompare(b.name))
}

function showCategoryDropdown(key, event) {
  clearTimeout(dropdownHideTimeout)
  hoveredCategory.value = key
  const rect = event.currentTarget.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: rect.bottom + 4 + 'px',
    left: Math.max(8, rect.left) + 'px',
    zIndex: 9999,
  }
}

function scheduleCategoryDropdownHide() {
  dropdownHideTimeout = setTimeout(() => {
    hoveredCategory.value = null
  }, 250)
}

function cancelCategoryDropdownHide() {
  clearTimeout(dropdownHideTimeout)
}

function flyToLocation(loc) {
  hoveredCategory.value = null
  store.selectLocation(loc)
  if (map) map.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 })
}

// --- Zones dropdown ---
const zonesDropdownOpen = ref(false)
const zonesDropdownStyle = ref({})
let zonesDropdownHideTimeout = null

function zonesByType(type) {
  return store.zones
    .filter(z => z.zone_type === type)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}

function showZonesDropdown(event) {
  clearTimeout(zonesDropdownHideTimeout)
  zonesDropdownOpen.value = true
  const rect = event.currentTarget.getBoundingClientRect()
  zonesDropdownStyle.value = {
    position: 'fixed',
    top: rect.bottom + 4 + 'px',
    left: Math.max(8, rect.left) + 'px',
    zIndex: 9999,
  }
}

function scheduleZonesDropdownHide() {
  zonesDropdownHideTimeout = setTimeout(() => {
    zonesDropdownOpen.value = false
  }, 250)
}

function cancelZonesDropdownHide() {
  clearTimeout(zonesDropdownHideTimeout)
}

function flyToZone(zone) {
  zonesDropdownOpen.value = false
  selectedZone.value = zone
  store.clearSelection()
  if (map) {
    const bounds = L.latLngBounds(zone.coordinates)
    map.flyToBounds(bounds, { duration: 0.8, padding: [60, 60], maxZoom: 17 })
  }
}

// --- Render markers with clustering ---

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()
  collapseExpandedCluster()

  const postsByLoc = getPostsByLocation()
  const clusters = computeClusters(store.filteredLocations)

  clusterData = []

  for (const cluster of clusters) {
    if (cluster.locations.length === 1) {
      // Single marker — same as before
      const loc = cluster.locations[0]
      const locPosts = postsByLoc[loc.id] || []
      const marker = L.marker([loc.lat, loc.lng], {
        icon: createMarkerIcon(loc.category, locPosts.length),
      })
      bindMarkerTooltipAndClick(marker, loc, locPosts)
      markersLayer.addLayer(marker)
    } else {
      // Cluster bubble
      const dominantColor = getDominantColor(cluster.locations)
      const marker = L.marker([cluster.center.lat, cluster.center.lng], {
        icon: createClusterIcon(cluster.locations.length, dominantColor),
      })

      const entry = { center: cluster.center, locations: cluster.locations, marker }
      clusterData.push(entry)

      marker.bindTooltip(`${cluster.locations.length} lieux`, {
        direction: 'top',
        offset: [0, -24],
        className: 'map-tooltip',
      })

      marker.on('mouseover', () => expandCluster(entry, postsByLoc))

      markersLayer.addLayer(marker)
    }
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
    radius: 45,
    blur: 30,
    maxZoom: 17,
    max: 2,
    minOpacity: 0.4,
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
    const polygon = L.polygon(zone.coordinates, {
      color: style.color,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      weight: style.weight,
      dashArray: style.dashArray,
    })
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

// Re-render tokens when the store state changes
watch(() => tokenStore.tokens, renderTokens, { deep: true })
watch(() => tokenStore.shares, renderTokens, { deep: true })

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

<style scoped src="./MapView.css">
/* styles in MapView.css */
</style>

<style>
/* Filter dropdown — unscoped because rendered via Teleport outside component scope */
.filter-dropdown {
  min-width: 180px;
  max-width: 260px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border, #2a2a4a);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 4px 0;
}
.filter-dropdown::-webkit-scrollbar { width: 4px; }
.filter-dropdown::-webkit-scrollbar-thumb { background: var(--border, #2a2a4a); border-radius: 2px; }
.filter-dropdown-item {
  padding: 6px 12px;
  font-size: 0.8rem;
  color: var(--text-primary, #e1e1e6);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}
.filter-dropdown-item:hover { background: rgba(255, 255, 255, 0.06); }
.filter-dropdown-empty {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-secondary, #8899a6);
  font-style: italic;
}
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

/* Weather filter on map tiles — overrides the static filter when conditions are active */
.map-container[style*="--map-weather-filter"] .leaflet-tile-pane {
  filter: var(--map-weather-filter);
  transition: filter 1.4s ease;
}

/* Weather overlay layer (rain/snow/lightning) — sits between tiles and markers */
.map-weather-overlay {
  position: absolute !important;
  inset: 0;
  z-index: 350;
  pointer-events: none;
}

/* --- Personal token + shared tokens --- */
.map-token-icon { background: transparent !important; border: none !important; }
.map-token-marker {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--text-secondary, #8899a6);
  background: var(--bg-secondary, #192734);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4px rgba(136,153,166,0.18), 0 2px 10px rgba(0,0,0,0.4);
}
.map-token-marker.mine {
  border-color: var(--hero-primary, #FFD700);
  box-shadow: 0 0 0 4px rgba(255,215,0,0.25), 0 0 14px rgba(255,215,0,0.55);
}
.map-token-marker.active {
  border-color: var(--accent, #1da1f2);
  box-shadow: 0 0 0 4px rgba(29,161,242,0.25), 0 0 16px rgba(29,161,242,0.7);
  animation: map-token-pulse 1.8s infinite;
}
.map-token-marker.mine.active {
  border-color: var(--hero-primary, #FFD700);
  box-shadow: 0 0 0 4px rgba(255,215,0,0.3), 0 0 16px rgba(255,215,0,0.7);
}
.map-token-marker img { width: 100%; height: 100%; object-fit: cover; }
.map-token-initials {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e1e8ed);
}
@keyframes map-token-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(29,161,242,0.25), 0 0 14px rgba(29,161,242,0.7); }
  50% { box-shadow: 0 0 0 10px rgba(29,161,242,0.05), 0 0 20px rgba(29,161,242,0.85); }
}
.map-token-popup .map-token-popup-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary, #e1e8ed); }
.map-token-popup .map-token-popup-handle { font-size: 0.78rem; color: var(--text-secondary, #8899a6); margin-top: 2px; }
.map-token-popup .map-token-popup-status { margin-top: 6px; font-size: 0.8rem; color: var(--accent, #1da1f2); }
.map-token-popup .map-token-popup-status.muted { color: var(--text-secondary, #8899a6); }
.map-token-popup .map-token-popup-coords { margin-top: 4px; font-size: 0.72rem; color: var(--text-secondary, #8899a6); font-variant-numeric: tabular-nums; }
</style>
