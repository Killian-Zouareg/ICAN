<template>
  <div class="arena-page">
    <div class="arena-header">
      <button @click="$router.push('/igames')" class="back-btn">&larr;</button>
      <h1>&#x2694; iArena</h1>
      <span v-if="arena.myRating" class="elo-badge">{{ arena.myRating.elo }}</span>
    </div>

    <!-- Pending challenges -->
    <div v-if="arena.pendingChallenges.length" class="pending-banner" @click="tab = 'fights'">
      &#x1F4E8; {{ arena.pendingChallenges.length }} d&eacute;fi{{ arena.pendingChallenges.length > 1 ? 's' : '' }} en attente
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="{ active: tab === 'challenge' }" @click="tab = 'challenge'">D&eacute;fier</button>
      <button :class="{ active: tab === 'fights' }" @click="tab = 'fights'">Combats</button>
      <button :class="{ active: tab === 'ranking' }" @click="tab = 'ranking'">Classement</button>
    </div>

    <!-- DEFIER -->
    <template v-if="tab === 'challenge'">
      <input v-model="search" type="text" class="search" placeholder="Chercher un joueur..." @input="onSearch" />
      <div v-for="p in players" :key="p.id" class="row" @click="openChallenge(p)">
        <img v-if="p.avatar_url" :src="p.avatar_url" class="av" />
        <span v-else class="av av-ph">&#x1F464;</span>
        <span class="name">{{ p.display_name }}</span>
        <span class="action">&#x2694;</span>
      </div>
      <p v-if="!searchLoading && players.length === 0" class="muted">Aucun joueur</p>
    </template>

    <!-- COMBATS -->
    <template v-if="tab === 'fights'">
      <div v-for="c in arena.pendingChallenges" :key="c.id" class="row pending">
        <img v-if="c.challenger?.avatar_url" :src="c.challenger.avatar_url" class="av" />
        <span v-else class="av av-ph">&#x1F464;</span>
        <span class="name flex1">{{ c.challenger?.display_name }}</span>
        <button class="btn-accept" :disabled="busy" @click="accept(c.id)">&#x2713;</button>
        <button class="btn-decline" :disabled="busy" @click="decline(c.id)">&#x2717;</button>
      </div>

      <div v-for="f in arena.fights" :key="f.id" class="row history" @click="showResult(f)">
        <span class="name flex1">{{ getOpponentName(f) }}</span>
        <span class="result" :class="getResultClass(f)">{{ getResultLabel(f) }}</span>
      </div>
      <p v-if="!arena.pendingChallenges.length && !arena.fights.length" class="muted">Aucun combat</p>
    </template>

    <!-- CLASSEMENT -->
    <template v-if="tab === 'ranking'">
      <div v-for="(r, i) in arena.ratings" :key="r.id" class="row rank-row" :class="{ mine: r.profile_id === myId }">
        <span class="rank-pos" v-html="i < 3 ? ['&#x1F947;','&#x1F948;','&#x1F949;'][i] : (i+1)"></span>
        <img v-if="r.profiles?.avatar_url" :src="r.profiles.avatar_url" class="av" />
        <span v-else class="av av-ph">&#x1F464;</span>
        <div class="col flex1">
          <span class="name">{{ r.profiles?.display_name }}</span>
          <span class="sub">{{ r.wins }}V {{ r.losses }}D
            <template v-if="r.streak > 0"> &middot; &#x1F525;{{ r.streak }}</template>
            <template v-else-if="r.streak < 0"> &middot; &#x1F9CA;{{ Math.abs(r.streak) }}</template>
          </span>
        </div>
        <span class="elo">{{ r.elo }}</span>
      </div>
      <p v-if="!arena.ratings.length" class="muted">Aucun joueur class&eacute;</p>
    </template>

    <!-- Modal défi -->
    <Teleport to="body">
      <div v-if="target" class="overlay" @click.self="target = null">
        <div class="modal">
          <h3>D&eacute;fier {{ target.display_name }} ?</h3>
          <div class="modal-btns">
            <button class="btn-cancel" @click="target = null">Annuler</button>
            <button class="btn-go" :disabled="busy" @click="sendChallenge">{{ busy ? '...' : '&#x2694; Go' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal résultat -->
    <Teleport to="body">
      <div v-if="fightRes" class="overlay" @click.self="fightRes = null">
        <div class="modal result-modal">
          <div class="result-title" :class="fightRes.winnerId === myId ? 'win' : 'lose'">
            {{ fightRes.winnerId === myId ? '&#x1F3C6; Victoire' : '&#x1F4A5; D\u00e9faite' }}
          </div>
          <div class="dice-row">
            <div class="dice-col">
              <span class="dice-label">Vous</span>
              <span class="dice-roll">&#x1F3B2; {{ fightRes.myRoll }}</span>
              <span v-if="fightRes.myBonus" class="dice-bonus">+{{ fightRes.myBonus }} stats</span>
              <span class="dice-total">= {{ fightRes.myTotal }}</span>
            </div>
            <span class="dice-vs">VS</span>
            <div class="dice-col">
              <span class="dice-label">{{ fightRes.opponentName }}</span>
              <span class="dice-roll">&#x1F3B2; {{ fightRes.oppRoll }}</span>
              <span v-if="fightRes.oppBonus" class="dice-bonus">+{{ fightRes.oppBonus }} stats</span>
              <span class="dice-total">= {{ fightRes.oppTotal }}</span>
            </div>
          </div>
          <button class="btn-go" @click="fightRes = null">OK</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useArenaStore } from '../stores/arena'

const auth = useAuthStore()
const arena = useArenaStore()

const tab = ref('challenge')
const search = ref('')
const players = ref([])
const searchLoading = ref(false)
const target = ref(null)
const busy = ref(false)
const fightRes = ref(null)

const myId = computed(() => auth.activeProfile?.id)

let timer = null
function onSearch() {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    searchLoading.value = true
    players.value = await arena.searchPlayers(search.value.trim())
    searchLoading.value = false
  }, 300)
}

function openChallenge(p) { target.value = p }

async function sendChallenge() {
  busy.value = true
  try {
    await arena.createChallenge(target.value.id)
    target.value = null
    alert('Défi envoyé !')
  } catch (e) { alert(e.message) }
  busy.value = false
}

async function accept(id) {
  busy.value = true
  try {
    const r = await arena.acceptChallenge(id)
    formatResult(r, id)
  } catch (e) { alert(e.message) }
  busy.value = false
}

async function decline(id) {
  busy.value = true
  try { await arena.declineChallenge(id) } catch (e) { alert(e.message) }
  busy.value = false
}

function formatResult(r, fightId) {
  const fight = arena.fights.find(f => f.id === fightId) || arena.pendingChallenges.find(f => f.id === fightId)
  const amChallenger = fight ? fight.challenger_id === myId.value : true
  fightRes.value = {
    winnerId: r.winnerId,
    myRoll: amChallenger ? r.challenger.roll : r.opponent.roll,
    myBonus: amChallenger ? r.challenger.bonus : r.opponent.bonus,
    myTotal: amChallenger ? r.challenger.total : r.opponent.total,
    oppRoll: amChallenger ? r.opponent.roll : r.challenger.roll,
    oppBonus: amChallenger ? r.opponent.bonus : r.challenger.bonus,
    oppTotal: amChallenger ? r.opponent.total : r.challenger.total,
    opponentName: fight ? (amChallenger ? fight.opponent?.display_name : fight.challenger?.display_name) : 'Adversaire',
  }
}

function showResult(f) {
  if (f.status === 'declined' || !f.fight_log) return
  const log = f.fight_log
  const amChallenger = f.challenger_id === myId.value
  fightRes.value = {
    winnerId: f.winner_id,
    myRoll: amChallenger ? log.challenger.roll : log.opponent.roll,
    myBonus: amChallenger ? log.challenger.bonus : log.opponent.bonus,
    myTotal: amChallenger ? log.challenger.total : log.opponent.total,
    oppRoll: amChallenger ? log.opponent.roll : log.challenger.roll,
    oppBonus: amChallenger ? log.opponent.bonus : log.challenger.bonus,
    oppTotal: amChallenger ? log.opponent.total : log.challenger.total,
    opponentName: amChallenger ? f.opponent?.display_name : f.challenger?.display_name,
  }
}

function getOpponentName(f) {
  return f.challenger_id === myId.value ? f.opponent?.display_name : f.challenger?.display_name
}
function getResultClass(f) {
  if (f.status === 'declined') return 'declined'
  return f.winner_id === myId.value ? 'win' : 'lose'
}
function getResultLabel(f) {
  if (f.status === 'declined') return 'Décliné'
  return f.winner_id === myId.value ? 'Victoire' : 'Défaite'
}

onMounted(async () => {
  players.value = await arena.searchPlayers('')
  await Promise.all([arena.fetchRatings(), arena.fetchPending(), arena.fetchMyFights()])
})
</script>

<style scoped src="./ArenaView.css"></style>
