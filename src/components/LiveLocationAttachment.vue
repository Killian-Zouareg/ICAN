<template>
  <div v-if="share" class="live-loc-attachment" :class="{ expired: !active }" @click.stop>
    <div ref="miniMap" class="live-loc-mini-map"></div>
    <div class="live-loc-overlay">
      <span class="live-loc-pulse" v-if="active"></span>
      <div class="live-loc-info">
        <div class="live-loc-title">
          <span class="live-loc-icon">📍</span>
          <span v-if="active">Position en direct</span>
          <span v-else>Partage terminé</span>
        </div>
        <div class="live-loc-meta">
          <span v-if="share.owner" class="live-loc-owner">
            {{ share.owner.display_name || share.owner.username }}
          </span>
          <span v-if="active" class="live-loc-timer">· {{ remainingLabel }}</span>
          <span v-else class="live-loc-timer">· terminé</span>
        </div>
      </div>
      <button class="live-loc-view-btn" @click.stop="openMap" :title="active ? 'Voir sur la carte' : 'Voir le dernier emplacement'">
        Voir
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserTokenStore } from '../stores/userToken'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  shareId: { type: String, required: true },
})

const tokenStore = useUserTokenStore()
const router = useRouter()
const miniMap = ref(null)
let map = null
let marker = null

const share = computed(() => tokenStore.shares.get(props.shareId) || null)
const active = computed(() => {
  const s = share.value
  if (!s) return false
  return new Date(s.expires_at).getTime() > tokenStore.nowTick
})
const token = computed(() => {
  const s = share.value
  if (!s) return null
  return tokenStore.getTokenForOwner(s.owner_id)
})

const remainingLabel = computed(() => {
  const s = share.value
  if (!s) return ''
  const ms = new Date(s.expires_at).getTime() - tokenStore.nowTick
  if (ms <= 0) return 'terminé'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s2 = totalSec % 60
  if (h > 0) return `Expire dans ${h}h${m.toString().padStart(2, '0')}`
  if (m > 0) return `Expire dans ${m} min`
  return `Expire dans ${s2}s`
})

function openMap() {
  router.push({ name: 'Map', query: { share: props.shareId } })
}

function buildIcon() {
  const s = share.value
  const avatar = s?.owner?.avatar_url
  const initials = (s?.owner?.display_name || s?.owner?.username || '?').slice(0, 2).toUpperCase()
  const inner = avatar
    ? `<img src="${avatar}" alt="" />`
    : `<span class="ll-token-initials">${initials}</span>`
  return L.divIcon({
    className: 'live-loc-token-icon',
    html: `<div class="ll-token-marker${active.value ? ' active' : ''}">${inner}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function renderMarker() {
  if (!map || !token.value) return
  const latlng = [token.value.lat, token.value.lng]
  if (!marker) {
    marker = L.marker(latlng, { icon: buildIcon() }).addTo(map)
  } else {
    marker.setLatLng(latlng)
    marker.setIcon(buildIcon())
  }
  try { map.panTo(latlng, { animate: true, duration: 0.4 }) } catch (_) {}
}

async function initMiniMap() {
  await nextTick()
  if (!miniMap.value || map) return
  const t = token.value
  const center = t ? [t.lat, t.lng] : [40.6084, -75.4902]
  map = L.map(miniMap.value, {
    center,
    zoom: 15,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
  })
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map)
  setTimeout(() => { try { map?.invalidateSize() } catch (_) {} }, 100)
  renderMarker()
}

onMounted(async () => {
  await tokenStore.ensureShare(props.shareId)
  initMiniMap()
})

watch(token, () => {
  if (!map) initMiniMap()
  else renderMarker()
})

watch(active, () => {
  if (marker) marker.setIcon(buildIcon())
})

onUnmounted(() => {
  if (map) {
    try { map.remove() } catch (_) {}
    map = null
    marker = null
  }
})
</script>

<style scoped>
.live-loc-attachment {
  position: relative;
  margin-top: 10px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  cursor: pointer;
}
.live-loc-attachment.expired {
  filter: grayscale(0.85);
  opacity: 0.7;
}
.live-loc-mini-map {
  width: 100%;
  height: 160px;
  background: var(--bg-primary);
}
.live-loc-overlay {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: linear-gradient(to top, rgba(21,32,43,0.95) 65%, rgba(21,32,43,0.4));
}
.live-loc-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 0 rgba(224, 36, 94, 0.7);
  animation: live-loc-pulse 1.6s infinite;
  flex-shrink: 0;
}
@keyframes live-loc-pulse {
  0% { box-shadow: 0 0 0 0 rgba(224, 36, 94, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(224, 36, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(224, 36, 94, 0); }
}
.live-loc-info {
  flex: 1;
  min-width: 0;
}
.live-loc-title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}
.live-loc-meta {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 2px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.live-loc-owner { color: var(--accent); }
.live-loc-timer { font-variant-numeric: tabular-nums; }
.live-loc-view-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.live-loc-view-btn:hover { background: var(--accent-hover); }
.expired .live-loc-view-btn { background: var(--bg-hover); color: var(--text-secondary); }
</style>

<style>
.live-loc-token-icon { background: transparent !important; border: none !important; }
.ll-token-marker {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--text-secondary, #8899a6);
  background: var(--bg-secondary, #192734);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4px rgba(136,153,166,0.18);
}
.ll-token-marker.active {
  border-color: var(--accent, #1da1f2);
  box-shadow: 0 0 0 4px rgba(29,161,242,0.25), 0 0 12px rgba(29,161,242,0.6);
  animation: ll-token-pulse 2s infinite;
}
.ll-token-marker img { width: 100%; height: 100%; object-fit: cover; }
.ll-token-initials {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary, #e1e8ed);
}
@keyframes ll-token-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(29,161,242,0.25), 0 0 12px rgba(29,161,242,0.6); }
  50% { box-shadow: 0 0 0 8px rgba(29,161,242,0.05), 0 0 18px rgba(29,161,242,0.8); }
}
</style>
