<template>
  <div class="territory-page">
    <div class="terr-header">
      <button @click="$router.push('/igames')" class="back-btn">&larr;</button>
      <h1>&#x1F3F0; Territoires</h1>
      <button class="rules-btn" @click="showRules = !showRules">?</button>
    </div>

    <!-- Rules popup -->
    <div v-if="showRules" class="rules-popup">
      <div class="rules-card">
        <h3>R&egrave;gles du jeu</h3>
        <p>Chaque jour, choisissez secr&egrave;tement un lieu. Les votes sont r&eacute;v&eacute;l&eacute;s &agrave; minuit.</p>
        <div v-for="loc in store.mergedLocations" :key="loc.id" class="rules-loc">
          <span class="rules-icon" :style="{ color: loc.color }">{{ loc.image_url ? '&#x1F3E0;' : loc.emoji }}</span>
          <span class="rules-name">{{ loc.name }}</span>
          <span class="rules-desc">{{ loc.desc }}</span>
        </div>
        <p class="rules-note">Si trop de joueurs choisissent le m&ecirc;me lieu, personne ne gagne les points !</p>
        <button class="rules-close" @click="showRules = false">Compris !</button>
      </div>
    </div>

    <div v-if="store.loading" class="muted">Chargement...</div>

    <template v-else>
      <div v-if="!isPlayer && !auth.isAdmin" class="muted">
        Vous ne participez pas. Contactez l'admin.
      </div>

      <!-- Day bar -->
      <div class="day-bar">
        <span class="day-label">&#x1F4C5; {{ todayLabel }}</span>
        <span v-if="store.myVoteToday" class="voted-badge">&#x2705; Vot&eacute;</span>
        <span v-else-if="isPlayer" class="waiting-badge">Choisissez un lieu</span>
      </div>

      <!-- ═══════ CARTE ═══════ -->
      <div class="board">
        <div class="board-texture"></div>

        <svg class="board-paths" viewBox="0 0 400 300" preserveAspectRatio="none">
          <path d="M200 45 L60 150" stroke="#8b7355" stroke-width="1.5" stroke-dasharray="6,4" fill="none" opacity="0.5" />
          <path d="M200 45 L340 150" stroke="#8b7355" stroke-width="1.5" stroke-dasharray="6,4" fill="none" opacity="0.5" />
          <path d="M60 150 L200 255" stroke="#8b7355" stroke-width="1.5" stroke-dasharray="6,4" fill="none" opacity="0.5" />
          <path d="M340 150 L200 255" stroke="#8b7355" stroke-width="1.5" stroke-dasharray="6,4" fill="none" opacity="0.5" />
          <path d="M60 150 L340 150" stroke="#8b7355" stroke-width="1" stroke-dasharray="4,6" fill="none" opacity="0.3" />
        </svg>

        <!-- Bâtiments -->
        <div
          v-for="(loc, li) in store.mergedLocations"
          :key="loc.id"
          class="building"
          :class="[
            loc.id,
            {
              clickable: isPlayer && !store.myVoteToday,
              selected: store.myVoteToday?.location_id === loc.id,
              won: isRevealed && locScored(loc.id),
              bust: isRevealed && !locScored(loc.id) && getPlayersOnLoc(loc.id).length > 0,
            }
          ]"
          :style="{ '--b-color': loc.color, top: buildingPos[li].top, left: buildingPos[li].left }"
          @click="pickLocation(loc.id)"
        >
          <div class="building-glow"></div>
          <div class="building-icon">
            <img v-if="loc.image_url" :src="loc.image_url" class="building-img" />
            <span v-else class="building-emoji">{{ loc.emoji }}</span>
          </div>
          <div class="building-label">{{ loc.name }}</div>

          <!-- Pions ONLY when revealed -->
          <div v-if="isRevealed" class="building-pions">
            <div
              v-for="p in getPlayersOnLoc(loc.id)"
              :key="p.id"
              class="pion revealed"
              :style="{ '--pion-color': getPionColor(p.id) }"
              :title="p.display_name"
            >
              <img v-if="p.avatar_url" :src="p.avatar_url" class="pion-photo" />
              <span v-else class="pion-init">{{ (p.display_name || '?')[0] }}</span>
            </div>
          </div>
        </div>

        <!-- Reveal timer -->
        <div v-if="!isRevealed && store.todayVotes.length > 0" class="reveal-timer">
          R&eacute;v&eacute;lation &agrave; minuit
        </div>
      </div>

      <!-- ═══════ JOUEURS (bloc principal) ═══════ -->
      <div class="players-panel">
        <h3>&#x1F3AE; Joueurs</h3>
        <div class="players-grid">
          <div v-for="p in store.players" :key="p.id" class="player-card">
            <div class="player-avatar" :style="{ borderColor: getPionColor(p.profile_id) }">
              <img v-if="p.profiles?.avatar_url" :src="p.profiles.avatar_url" class="player-avatar-img" />
              <span v-else class="player-avatar-init" :style="{ color: getPionColor(p.profile_id) }">{{ (p.profiles?.display_name || '?')[0] }}</span>
            </div>
            <span class="player-name">{{ p.profiles?.display_name }}</span>
            <span v-if="hasVotedToday(p.profile_id)" class="player-status voted">&#x2705;</span>
            <span v-else class="player-status pending">&#x23F3;</span>
          </div>
        </div>
      </div>

      <!-- ═══════ LEADERBOARD ═══════ -->
      <div class="lb-parchment">
        <h2>&#x1F3C6; Classement</h2>
        <div v-if="store.leaderboard.length === 0" class="muted-sm">Aucun score</div>
        <div v-for="(r, i) in store.leaderboard" :key="r.id" class="lb-row" :class="{ mine: r.profile_id === myId }">
          <span class="lb-rank" v-html="i < 3 ? ['&#x1F947;','&#x1F948;','&#x1F949;'][i] : (i+1)"></span>
          <img v-if="r.profiles?.avatar_url" :src="r.profiles.avatar_url" class="lb-av" />
          <span v-else class="lb-av lb-av-ph">{{ (r.profiles?.display_name || '?')[0] }}</span>
          <div class="lb-info">
            <span class="lb-name">{{ r.profiles?.display_name }}</span>
            <span class="lb-sub">{{ r.days_played }}j</span>
          </div>
          <div class="lb-bar-wrap">
            <div class="lb-bar" :style="{ width: barWidth(r.total_points) + '%' }"></div>
          </div>
          <span class="lb-pts">{{ r.total_points }}</span>
        </div>
      </div>

      <!-- ═══════ HISTORIQUE ═══════ -->
      <div v-if="pastDays.length" class="history-section">
        <h2>&#x1F4DC; Historique</h2>
        <div v-for="day in pastDays" :key="day" class="history-day">
          <span class="history-date">{{ formatDay(day) }}</span>
          <div class="history-locs">
            <span v-for="loc in store.mergedLocations" :key="loc.id" class="history-loc">
              {{ loc.image_url ? '' : loc.emoji }} {{ getHistoryCount(day, loc.id) }}
              <span v-if="historyScored(day, loc.id)" class="h-ok">&#x2705;</span>
              <span v-else-if="getHistoryCount(day, loc.id) > 0" class="h-fail">&#x274C;</span>
            </span>
          </div>
        </div>
      </div>

      <!-- ═══════ ADMIN ═══════ -->
      <div v-if="auth.isAdmin" class="admin-section">
        <h3>Joueurs ({{ store.players.length }}/7)</h3>
        <div v-for="p in store.players" :key="p.id" class="admin-row">
          <div class="pion mini" :style="{ '--pion-color': getPionColor(p.profile_id) }">
            <img v-if="p.profiles?.avatar_url" :src="p.profiles.avatar_url" class="pion-photo" />
            <span v-else class="pion-init">{{ (p.profiles?.display_name || '?')[0] }}</span>
          </div>
          <span class="admin-name">{{ p.profiles?.display_name }}</span>
          <button class="btn-remove" @click="removeP(p.profile_id)">&times;</button>
        </div>
        <div v-if="store.players.length < 7" class="admin-add">
          <input v-model="addSearch" type="text" placeholder="Ajouter un joueur..." @input="searchProfiles" />
          <div v-for="sp in searchResults" :key="sp.id" class="admin-row add-row" @click="addP(sp.id)">
            <span>{{ sp.display_name }}</span>
            <span class="add-icon">+</span>
          </div>
        </div>

        <h3>R&eacute;initialiser</h3>
        <div class="admin-reset">
          <button class="btn-reset" @click="resetVotes">&#x1F5D1;&#xFE0F; Reset votes</button>
          <button class="btn-reset danger" @click="resetLeaderboard">&#x1F4A5; Reset classement</button>
        </div>

        <h3>Lieux</h3>
        <div v-for="loc in store.mergedLocations" :key="loc.id" class="admin-loc">
          <div class="admin-loc-preview">
            <img v-if="loc.image_url" :src="loc.image_url" class="admin-loc-img" />
            <span v-else class="admin-loc-emoji">{{ loc.emoji }}</span>
          </div>
          <input :value="loc.name" @change="renameLocation(loc.id, $event.target.value)" class="admin-loc-input" />
          <label class="admin-loc-upload">
            &#x1F4F7;
            <input type="file" accept="image/*" hidden @change="uploadLocImg(loc.id, $event)" />
          </label>
          <span class="admin-loc-rule">{{ loc.desc }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTerritoryStore, SLOT_RULES, PION_COLORS } from '../stores/territory'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const store = useTerritoryStore()

const showRules = ref(false)
const myId = computed(() => auth.activeProfile?.id)
const isPlayer = computed(() => store.players.some(p => p.profile_id === myId.value))

// Revealed = yesterday's votes (today is a new day, previous day is revealed)
// OR all 7 voted today
const isRevealed = computed(() => store.todayRevealed)

const buildingPos = [
  { top: '15%', left: '50%' },
  { top: '50%', left: '15%' },
  { top: '50%', left: '85%' },
  { top: '85%', left: '50%' },
]

const todayLabel = computed(() => {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
})

const today = computed(() => new Date().toISOString().slice(0, 10))

const pastDays = computed(() => {
  const days = new Set(store.votes.map(v => v.day))
  days.delete(today.value)
  return [...days].sort().reverse().slice(0, 7)
})

function hasVotedToday(profileId) {
  return store.todayVotes.some(v => v.profile_id === profileId)
}

function getPionColor(profileId) {
  const idx = store.players.findIndex(p => p.profile_id === profileId)
  return PION_COLORS[idx >= 0 ? idx : 0]
}

function getPlayersOnLoc(locId) {
  const pids = store.todayVotes.filter(v => v.location_id === locId).map(v => v.profile_id)
  return store.players.filter(p => pids.includes(p.profile_id)).map(p => p.profiles).filter(Boolean)
}

function locScored(locId) {
  const slot = SLOT_RULES.find(s => s.id === locId)
  return getPlayersOnLoc(locId).length > 0 && getPlayersOnLoc(locId).length <= slot.maxPlayers
}

function getHistoryCount(day, locId) {
  return store.votes.filter(v => v.day === day && v.location_id === locId).length
}

function historyScored(day, locId) {
  const slot = SLOT_RULES.find(s => s.id === locId)
  const count = getHistoryCount(day, locId)
  return count > 0 && count <= slot.maxPlayers
}

function barWidth(pts) {
  const max = store.leaderboard[0]?.total_points || 1
  return Math.round((pts / max) * 100)
}

function formatDay(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

async function pickLocation(locId) {
  if (!isPlayer.value || store.myVoteToday) return
  try { await store.vote(locId) } catch (e) { alert(e.message) }
}

// Admin
const addSearch = ref('')
const searchResults = ref([])
let searchTimer = null

function searchProfiles() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (!addSearch.value.trim()) { searchResults.value = []; return }
    const existing = store.players.map(p => p.profile_id)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .or(`display_name.ilike.%${addSearch.value}%,username.ilike.%${addSearch.value}%`)
      .limit(10)
    searchResults.value = (data || []).filter(p => !existing.includes(p.id))
  }, 300)
}

async function addP(pid) {
  try { await store.addPlayer(pid); addSearch.value = ''; searchResults.value = [] } catch (e) { alert(e.message) }
}

async function removeP(pid) {
  if (!confirm('Retirer ?')) return
  await store.removePlayer(pid)
}

async function renameLocation(locId, name) {
  if (!name.trim()) return
  try { await store.updateLocationName(locId, name.trim()) } catch (e) { alert(e.message) }
}

async function resetVotes() {
  if (!confirm('Supprimer TOUS les votes (tous les jours) ? Cette action est irr\u00e9versible.')) return
  try { await store.resetVotes() } catch (e) { alert(e.message) }
}

async function resetLeaderboard() {
  if (!confirm('Supprimer TOUT le classement ? Les points de tous les joueurs seront remis \u00e0 z\u00e9ro.')) return
  try { await store.resetLeaderboard() } catch (e) { alert(e.message) }
}

async function uploadLocImg(locId, e) {
  const file = e.target.files?.[0]
  if (!file) return
  try { await store.uploadLocationImage(locId, file) } catch (e) { alert(e.message) }
}

onMounted(() => store.init())
</script>

<style scoped src="./TerritoryView.css"></style>
