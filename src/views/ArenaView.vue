<template>
  <div class="arena-page">
    <div class="arena-header">
      <button @click="$router.push('/igames')" class="back-btn">&larr;</button>
      <h1>&#x2694;&#xFE0F; iArena</h1>
      <button class="rules-btn" @click="showRules = !showRules">?</button>
    </div>

    <!-- Rules popup -->
    <div v-if="showRules" class="rules-popup" @click.self="showRules = false">
      <div class="rules-card">
        <h3>R&egrave;gles</h3>
        <p>Tournoi en &eacute;limination directe d'une dur&eacute;e de {{ store.TOURNAMENT_DURATION_HOURS }}h. Les combattants sont s&eacute;lectionn&eacute;s par l'admin.</p>
        <ul>
          <li>PV = 20 + vigueur &times; 10</li>
          <li>Chaque tour, une stat est tir&eacute;e au sort. L'attaquant fait un jet, le d&eacute;fenseur doit &eacute;galer ou d&eacute;passer pour se prot&eacute;ger.</li>
          <li>D&eacute;g&acirc;ts = diff&eacute;rence des jets.</li>
          <li>Vainqueur du tournoi : <strong>+{{ store.POINTS_WINNER }} pts</strong></li>
          <li>Pari correct : <strong>+{{ store.POINTS_BET_CORRECT }} pts</strong></li>
        </ul>
        <button class="rules-close" @click="showRules = false">Compris</button>
      </div>
    </div>

    <div v-if="store.loading" class="muted">Chargement...</div>

    <template v-else>
      <div v-if="!store.currentTournament" class="muted">
        Aucun tournoi en cours. En attente de la s&eacute;lection admin (min. 2 joueurs).
      </div>

      <template v-else>
        <!-- Tournament banner -->
        <div class="tournament-banner">
          <span class="t-status" :class="store.currentTournament.status">
            {{ store.currentTournament.status === 'active' ? '&#x1F525; Tournoi en cours' : '&#x2705; Tournoi termin&eacute;' }}
          </span>
          <span v-if="store.currentTournament.status === 'active'" class="t-timer">
            Fin dans {{ timeUntilTournamentEnd }}
          </span>
        </div>

        <!-- TOURNAMENT FINISHED — winner screen -->
        <div v-if="store.currentTournament.status === 'finished' && tournamentWinner" class="winner-screen">
          <div class="winner-crown">&#x1F451;</div>
          <div class="winner-title">Vainqueur du tournoi</div>
          <div class="winner-card">
            <div class="winner-avatar">
              <img v-if="tournamentWinner.avatar_url" :src="tournamentWinner.avatar_url" />
              <span v-else class="avatar-ph">{{ (tournamentWinner.display_name || '?')[0] }}</span>
            </div>
            <div class="winner-name">{{ tournamentWinner.display_name }}</div>
            <div class="winner-pts">+{{ store.POINTS_WINNER }} pts</div>
          </div>
          <div class="next-tournament">
            Prochain tournoi : {{ nextTournamentLabel }}
          </div>
        </div>

        <!-- Bracket mini -->
        <div class="bracket">
          <div v-for="r in rounds" :key="r" class="bracket-round">
            <div class="round-label">{{ roundLabel(r) }}</div>
            <div
              v-for="f in fightsByRound[r]"
              :key="f.id"
              class="bracket-fight"
              :class="{ current: f.id === currentFight?.id, done: isFightDone(f) }"
            >
              <div class="bracket-slot" :class="{ winner: f.winner_id === f.player_a_id && isFightDone(f) }">
                <span class="bracket-name">{{ getName(f.player_a_id) || '?' }}</span>
              </div>
              <div class="bracket-slot" :class="{ winner: f.winner_id === f.player_b_id && isFightDone(f) }">
                <span class="bracket-name">{{ getName(f.player_b_id) || '?' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- CURRENT / NEXT FIGHT (hide if tournament finished) -->
        <div v-if="currentFight && store.currentTournament.status === 'active'" class="fight-arena">
          <div class="fight-title">
            <template v-if="fightStarted">&#x1F4A5; Combat en cours</template>
            <template v-else>&#x23F3; Prochain combat dans {{ timeUntilFightStart }}</template>
          </div>

          <div class="fighters">
            <!-- Left fighter -->
            <div class="fighter" :class="{ ko: fightStarted && animatedHpA <= 0 }">
              <div class="fighter-avatar">
                <img v-if="getAvatar(currentFight.player_a_id)" :src="getAvatar(currentFight.player_a_id)" />
                <span v-else class="avatar-ph">{{ (getName(currentFight.player_a_id) || '?')[0] }}</span>
              </div>
              <div class="fighter-name">{{ getName(currentFight.player_a_id) }}</div>
              <div class="hp-bar">
                <div class="hp-fill" :style="{ width: hpPctA + '%' }"></div>
                <span class="hp-text">{{ animatedHpA }} / {{ maxHpA }}</span>
              </div>
            </div>

            <!-- VS center -->
            <div class="vs-center">
              <div class="vs-big">VS</div>
              <div v-if="fightStarted && activeTurn" class="turn-stat">
                <span class="stat-emoji">{{ statEmoji(activeTurn.stat) }}</span>
                <span class="stat-label">{{ statLabel(activeTurn.stat) }}</span>
              </div>
              <div v-if="fightStarted && activeTurn" class="dice-row">
                <span class="dice">{{ activeTurn.attacker_roll }}</span>
                <span class="dice-vs">vs</span>
                <span class="dice">{{ activeTurn.defender_roll }}</span>
              </div>
              <div v-if="fightStarted && activeTurn" class="dmg">
                <span v-if="activeTurn.damage > 0">-{{ activeTurn.damage }} PV</span>
                <span v-else class="parade">Parade !</span>
              </div>
            </div>

            <!-- Right fighter -->
            <div class="fighter" :class="{ ko: fightStarted && animatedHpB <= 0 }">
              <div class="fighter-avatar">
                <img v-if="getAvatar(currentFight.player_b_id)" :src="getAvatar(currentFight.player_b_id)" />
                <span v-else class="avatar-ph">{{ (getName(currentFight.player_b_id) || '?')[0] }}</span>
              </div>
              <div class="fighter-name">{{ getName(currentFight.player_b_id) }}</div>
              <div class="hp-bar">
                <div class="hp-fill" :style="{ width: hpPctB + '%' }"></div>
                <span class="hp-text">{{ animatedHpB }} / {{ maxHpB }}</span>
              </div>
            </div>
          </div>

          <!-- Betting -->
          <div v-if="!fightStarted && canBet" class="betting">
            <h4>Pariez sur le vainqueur</h4>
            <div class="bet-row">
              <button
                class="bet-btn"
                :class="{ active: myBet?.picked_winner_id === currentFight.player_a_id }"
                @click="bet(currentFight.player_a_id)"
              >
                {{ getName(currentFight.player_a_id) }}
              </button>
              <button
                class="bet-btn"
                :class="{ active: myBet?.picked_winner_id === currentFight.player_b_id }"
                @click="bet(currentFight.player_b_id)"
              >
                {{ getName(currentFight.player_b_id) }}
              </button>
            </div>
            <button v-if="myBet" class="cancel-bet" @click="cancelBet">Annuler mon pari</button>
            <div class="bet-counts">
              <span>{{ betCountA }} paris</span>
              <span>{{ betCountB }} paris</span>
            </div>
          </div>

          <!-- Fight log -->
          <div v-if="fightStarted && visibleTurns.length" class="fight-log">
            <div v-for="t in visibleTurns.slice().reverse()" :key="t.turn_index" class="log-row">
              <span class="log-stat">{{ statEmoji(t.stat) }}</span>
              <span class="log-text">
                {{ getName(t.attacker_id) }} attaque
                <span v-if="t.damage > 0">&#x2794; <b class="dmg-num">-{{ t.damage }}</b> PV</span>
                <span v-else class="log-parade">&#x2794; parade</span>
                ({{ t.attacker_roll }} vs {{ t.defender_roll }})
              </span>
            </div>
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="lb-section">
          <h2>&#x1F3C6; Classement</h2>
          <div v-if="!store.ratings.length" class="muted-sm">Aucun joueur class&eacute;</div>
          <div v-for="(r, i) in store.ratings" :key="r.id" class="lb-row" :class="{ mine: r.profile_id === myId }">
            <span class="lb-rank" v-html="i < 3 ? ['&#x1F947;','&#x1F948;','&#x1F949;'][i] : (i+1)"></span>
            <img v-if="r.profiles?.avatar_url" :src="r.profiles.avatar_url" class="lb-av" />
            <span v-else class="lb-av lb-av-ph">{{ (r.profiles?.display_name || '?')[0] }}</span>
            <span class="lb-name">{{ r.profiles?.display_name }}</span>
            <span class="lb-stats">{{ r.tournaments_won || 0 }}&#x1F3C6; &middot; {{ r.correct_bets || 0 }}&#x1F3AF;</span>
            <span class="lb-pts">{{ r.points_total }} pts</span>
          </div>
        </div>
      </template>

      <!-- ADMIN -->
      <div v-if="auth.isAdmin" class="admin-section">
        <h3>Pool de joueurs ({{ store.pool.length }})</h3>
        <p class="admin-help">Les tournois utilisent la plus grande puissance de 2 joueurs &le; au pool (min 2, max 8).</p>
        <div v-for="p in store.pool" :key="p.profile_id" class="admin-row">
          <img v-if="p.profiles?.avatar_url" :src="p.profiles.avatar_url" class="admin-av" />
          <span v-else class="admin-av admin-av-ph">{{ (p.profiles?.display_name || '?')[0] }}</span>
          <span class="admin-name">{{ p.profiles?.display_name }}</span>
          <button class="btn-remove" @click="removeP(p.profile_id)">&times;</button>
        </div>
        <div class="admin-add">
          <input v-model="addSearch" type="text" placeholder="Ajouter un joueur..." @input="searchProfiles" />
          <div v-for="sp in searchResults" :key="sp.id" class="admin-row add-row" @click="addP(sp.id)">
            <img v-if="sp.avatar_url" :src="sp.avatar_url" class="admin-av" />
            <span v-else class="admin-av admin-av-ph">{{ (sp.display_name || '?')[0] }}</span>
            <span class="admin-name">{{ sp.display_name }}</span>
            <span class="add-icon">+</span>
          </div>
        </div>
        <div class="admin-actions">
          <button class="btn-reset" @click="forceTournament">&#x26A1; D&eacute;marrer un nouveau tournoi</button>
          <button class="btn-reset" @click="endTournament" :disabled="store.currentTournament?.status !== 'active'">
            &#x23E9; Mettre fin au tournoi (acc&eacute;l&eacute;rer)
          </button>
          <button class="btn-reset danger" @click="resetLb">&#x1F4A5; Reset classement</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useArenaStore } from '../stores/arena'
import { simulateFight, STAT_LABELS } from '../lib/arenaFight'
import { hashSeed } from '../lib/seededRandom'

const auth = useAuthStore()
const store = useArenaStore()

const showRules = ref(false)
const now = ref(Date.now())
let tickInterval = null

const myId = computed(() => auth.activeProfile?.id)

// Rounds groupés
const rounds = computed(() => {
  const set = new Set(store.currentFights.map(f => f.round))
  return [...set].sort((a, b) => a - b)
})
const fightsByRound = computed(() => {
  const map = {}
  for (const f of store.currentFights) {
    if (!map[f.round]) map[f.round] = []
    map[f.round].push(f)
  }
  for (const r of Object.keys(map)) map[r].sort((a, b) => a.bracket_position - b.bracket_position)
  return map
})

// Current fight = prochain combat dont scheduled_start_at + duration >= now
const currentFight = computed(() => {
  const sorted = [...store.currentFights].sort((a, b) => new Date(a.scheduled_start_at) - new Date(b.scheduled_start_at))
  const fd = store.currentTournament?.fight_duration_seconds || 0
  for (const f of sorted) {
    const start = new Date(f.scheduled_start_at).getTime()
    const end = start + fd * 1000
    if (now.value < end) return f
  }
  return sorted[sorted.length - 1] || null
})

const fightStarted = computed(() => currentFight.value && now.value >= new Date(currentFight.value.scheduled_start_at).getTime())

// Simulation du combat courant
const currentSim = computed(() => {
  if (!currentFight.value || !store.currentTournament) return null
  const f = currentFight.value
  const seed = hashSeed('fight', store.currentTournament.seed, f.round, f.bracket_position)
  const pA = { id: f.player_a_id, sheet: store.sheets[f.player_a_id] || {} }
  const pB = { id: f.player_b_id, sheet: store.sheets[f.player_b_id] || {} }
  if (!f.player_a_id || !f.player_b_id) return null
  return simulateFight(seed, pA, pB)
})

const maxHpA = computed(() => currentSim.value?.max_hp_a || 0)
const maxHpB = computed(() => currentSim.value?.max_hp_b || 0)

// Animation : les tours s'étalent uniformément sur toute la durée du combat
const turnIntervalMs = computed(() => {
  if (!currentSim.value || !store.currentTournament) return 3000
  const total = currentSim.value.turns.length
  if (total <= 0) return 3000
  const fightMs = (store.currentTournament.fight_duration_seconds || 0) * 1000
  return Math.max(100, Math.floor(fightMs / total))
})
const animTurnIndex = computed(() => {
  if (!fightStarted.value || !currentSim.value) return -1
  const elapsed = now.value - new Date(currentFight.value.scheduled_start_at).getTime()
  const idx = Math.floor(elapsed / turnIntervalMs.value)
  return Math.min(idx, currentSim.value.turns.length - 1)
})
const visibleTurns = computed(() => {
  if (!currentSim.value || animTurnIndex.value < 0) return []
  return currentSim.value.turns.slice(0, animTurnIndex.value + 1)
})
const activeTurn = computed(() => {
  if (!currentSim.value || animTurnIndex.value < 0) return null
  return currentSim.value.turns[animTurnIndex.value] || null
})
const animatedHpA = computed(() => {
  const t = activeTurn.value
  if (!t) return maxHpA.value
  return t.hp_a_after
})
const animatedHpB = computed(() => {
  const t = activeTurn.value
  if (!t) return maxHpB.value
  return t.hp_b_after
})
const hpPctA = computed(() => maxHpA.value ? Math.max(0, (animatedHpA.value / maxHpA.value) * 100) : 0)
const hpPctB = computed(() => maxHpB.value ? Math.max(0, (animatedHpB.value / maxHpB.value) * 100) : 0)

// Timers
function fmtDuration(ms) {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${sec}s`
  return `${sec}s`
}
const timeUntilFightStart = computed(() => {
  if (!currentFight.value) return '-'
  return fmtDuration(new Date(currentFight.value.scheduled_start_at).getTime() - now.value)
})
const timeUntilNextFight = computed(() => {
  const sorted = [...store.currentFights].sort((a, b) => new Date(a.scheduled_start_at) - new Date(b.scheduled_start_at))
  for (const f of sorted) {
    const start = new Date(f.scheduled_start_at).getTime()
    if (start > now.value) return fmtDuration(start - now.value)
  }
  return 'En cours'
})

// Fin du tournoi = dernier fight scheduled_start_at + fight_duration
const tournamentEndMs = computed(() => {
  if (!store.currentFights.length || !store.currentTournament) return 0
  const last = [...store.currentFights].sort((a, b) => new Date(b.scheduled_start_at) - new Date(a.scheduled_start_at))[0]
  return new Date(last.scheduled_start_at).getTime() + (store.currentTournament.fight_duration_seconds || 0) * 1000
})
const timeUntilTournamentEnd = computed(() => {
  if (!tournamentEndMs.value) return '-'
  return fmtDuration(tournamentEndMs.value - now.value)
})
const nextTournamentLabel = computed(() => {
  if (store.pool.length < 2) return 'en attente (admin doit ajouter des joueurs au pool)'
  const t = store.currentTournament
  if (!t?.finalized_at) return 'bient\u00f4t'
  const pauseMs = 30 * 1000
  const remaining = new Date(t.finalized_at).getTime() + pauseMs - now.value
  if (remaining <= 0) return 'd\u00e9marrage imminent...'
  return `dans ${fmtDuration(remaining)}`
})

// Betting
const canBet = computed(() => {
  if (!currentFight.value || !myId.value) return false
  if (currentFight.value.player_a_id === myId.value || currentFight.value.player_b_id === myId.value) return false
  return !fightStarted.value
})
const myBet = computed(() => currentFight.value ? store.myBetsByFight[currentFight.value.id] : null)
const betCountA = computed(() =>
  currentFight.value ? store.currentBets.filter(b => b.fight_id === currentFight.value.id && b.picked_winner_id === currentFight.value.player_a_id).length : 0
)
const betCountB = computed(() =>
  currentFight.value ? store.currentBets.filter(b => b.fight_id === currentFight.value.id && b.picked_winner_id === currentFight.value.player_b_id).length : 0
)

async function bet(pickedId) {
  try { await store.placeBet(currentFight.value.id, pickedId) } catch (e) { alert(e.message) }
}
async function cancelBet() {
  try { await store.cancelBet(currentFight.value.id) } catch (e) { alert(e.message) }
}

// Bracket helpers
function isFightDone(f) {
  const end = new Date(f.scheduled_start_at).getTime() + (store.currentTournament?.fight_duration_seconds || 0) * 1000
  return now.value >= end
}
function roundLabel(r) {
  const max = rounds.value[rounds.value.length - 1]
  if (r === max) return 'Finale'
  if (r === max - 1) return 'Demies'
  if (r === max - 2) return 'Quarts'
  return `R${r}`
}
function getName(pid) {
  if (!pid) return null
  const s = store.sheets[pid]
  if (s?.prenom || s?.nom) return `${s.prenom || ''} ${s.nom || ''}`.trim()
  const poolP = store.pool.find(p => p.profile_id === pid)
  return poolP?.profiles?.display_name || 'Joueur'
}
function getAvatar(pid) {
  if (!pid) return null
  const s = store.sheets[pid]
  if (s?.photo_url) return s.photo_url
  const poolP = store.pool.find(p => p.profile_id === pid)
  return poolP?.profiles?.avatar_url || null
}
function statEmoji(s) { return STAT_LABELS[s]?.emoji || '' }
function statLabel(s) { return STAT_LABELS[s]?.label || s }

const tournamentWinner = computed(() => {
  const wid = store.currentTournament?.winner_id
  if (!wid) return null
  const s = store.sheets[wid]
  const name = getName(wid)
  return { display_name: name, avatar_url: getAvatar(wid) }
})

// Admin
const addSearch = ref('')
const searchResults = ref([])
let searchTimer = null
function searchProfiles() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    searchResults.value = await store.searchProfiles(addSearch.value)
  }, 300)
}
async function addP(pid) {
  try { await store.addToPool(pid); addSearch.value = ''; searchResults.value = [] } catch (e) { alert(e.message) }
}
async function removeP(pid) {
  if (!confirm('Retirer du pool ?')) return
  await store.removeFromPool(pid)
}
async function forceTournament() {
  if (!confirm('D\u00e9marrer un nouveau tournoi maintenant ?')) return
  try {
    const ok = await store.forceNewTournament()
    if (!ok) alert('Impossible : au moins 2 joueurs requis dans le pool.')
  } catch (e) { alert(e.message) }
}

async function endTournament() {
  if (!confirm('Mettre fin au tournoi en cours ? Le vainqueur et les paris seront r\u00e9solus imm\u00e9diatement.')) return
  try { await store.endTournamentNow() } catch (e) { alert(e.message) }
}

async function resetLb() {
  if (!confirm('Supprimer TOUT le classement ? Les tournois gagn\u00e9s et paris corrects de tous les joueurs seront remis \u00e0 z\u00e9ro.')) return
  try { await store.resetLeaderboard() } catch (e) { alert(e.message) }
}

// Tick timer — met à jour now chaque seconde
onMounted(async () => {
  await store.init()
  tickInterval = setInterval(async () => {
    now.value = Date.now()
    // Tente finalisation si tournoi terminé
    if (store.currentTournament?.status === 'active') {
      store.finalizeTournamentIfDone().catch(() => {})
    }
    // Si tournoi fini, tenter de démarrer le suivant (back-to-back)
    if (store.currentTournament?.status === 'finished') {
      store.maybeStartNewTournament().catch(() => {})
    }
  }, 2000)
})

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})
</script>

<style scoped src="./ArenaView.css"></style>
