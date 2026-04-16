import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { generateBracket, resolveBracket, computeMaxHp } from '../lib/arenaFight'

const TOURNAMENT_DURATION_HOURS = 10
const POINTS_WINNER = 100
const POINTS_BET_CORRECT = 10
// Pause minimale entre 2 tournois pour afficher l'écran vainqueur
const INTER_TOURNAMENT_PAUSE_SECONDS = 30

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000)
}

function largestPowerOfTwo(n) {
  let p = 1
  while (p * 2 <= n) p *= 2
  return p
}

export const useArenaStore = defineStore('arena', () => {
  const pool = ref([])
  const currentTournament = ref(null)
  const currentFights = ref([])
  const currentBets = ref([])
  const ratings = ref([])
  const sheets = ref({})
  const loading = ref(false)

  function getProfileId() {
    return useAuthStore().activeProfile?.id
  }

  const myBetsByFight = computed(() => {
    const pid = getProfileId()
    if (!pid) return {}
    const map = {}
    for (const b of currentBets.value) {
      if (b.bettor_id === pid) map[b.fight_id] = b
    }
    return map
  })

  // ═══════════════════════════════════════════════════════════
  async function fetchPool() {
    const { data } = await supabase
      .from('arena_pool')
      .select('profile_id, added_at, profiles(id, display_name, username, avatar_url)')
      .order('added_at')
    pool.value = data || []
  }

  async function fetchRatings() {
    const { data } = await supabase
      .from('arena_ratings')
      .select('*, profiles(id, display_name, username, avatar_url)')
    const rows = (data || []).map(r => ({
      ...r,
      points_total: (r.tournaments_won || 0) * POINTS_WINNER + (r.correct_bets || 0) * POINTS_BET_CORRECT,
    }))
    rows.sort((a, b) => b.points_total - a.points_total)
    ratings.value = rows
  }

  async function fetchCurrentTournament() {
    const { data } = await supabase
      .from('arena_tournaments')
      .select('*')
      .order('start_at', { ascending: false })
      .limit(1)
    currentTournament.value = data?.[0] || null
    if (currentTournament.value) {
      await fetchFightsAndBets(currentTournament.value.id)
      await fetchSheetsFor(currentTournament.value.player_ids || [])
    } else {
      currentFights.value = []
      currentBets.value = []
    }
  }

  async function fetchFightsAndBets(tournamentId) {
    const { data: fData } = await supabase
      .from('arena_fights')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('bracket_position')
    currentFights.value = fData || []
    const fightIds = (fData || []).map(f => f.id)
    if (fightIds.length) {
      const { data: bData } = await supabase.from('arena_bets').select('*').in('fight_id', fightIds)
      currentBets.value = bData || []
    } else {
      currentBets.value = []
    }
  }

  async function fetchSheetsFor(profileIds) {
    if (!profileIds.length) return
    const { data } = await supabase
      .from('character_sheets')
      .select('profile_id, force, vigueur, mobilite, intelligence, charisme, nom, prenom, photo_url')
      .in('profile_id', profileIds)
    const map = {}
    for (const s of data || []) map[s.profile_id] = s
    sheets.value = map
  }

  // ═══════════════════════════════════════════════════════════
  async function addToPool(profileId) {
    const { error } = await supabase.from('arena_pool').insert({ profile_id: profileId })
    if (error) throw new Error(error.message)
    await fetchPool()
  }

  async function removeFromPool(profileId) {
    const { error } = await supabase.from('arena_pool').delete().eq('profile_id', profileId)
    if (error) throw new Error(error.message)
    await fetchPool()
  }

  async function searchProfiles(query) {
    if (!query?.trim()) return []
    const existing = pool.value.map(p => p.profile_id)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(10)
    return (data || []).filter(p => !existing.includes(p.id))
  }

  // ═══════════════════════════════════════════════════════════
  async function maybeStartNewTournament() {
    const last = currentTournament.value
    // Laisser une pause après la finalisation pour montrer le vainqueur
    if (last?.status === 'finished' && last.finalized_at) {
      const elapsed = Date.now() - new Date(last.finalized_at).getTime()
      if (elapsed < INTER_TOURNAMENT_PAUSE_SECONDS * 1000) return false
    }
    const canStart = !last || last.status === 'finished'
    if (!canStart) return false

    const poolIds = pool.value.map(p => p.profile_id)
    const bracketSize = largestPowerOfTwo(poolIds.length)
    if (bracketSize < 2) return false

    const playerIds = poolIds.slice(0, bracketSize)
    await fetchSheetsFor(playerIds)

    const seed = randomSeed()
    // Nombre de combats dans un bracket single-elim = bracketSize - 1
    const numberOfFights = bracketSize - 1
    // Chaque combat s'étale sur (durée totale / nombre de combats)
    const fightDuration = Math.floor((TOURNAMENT_DURATION_HOURS * 3600) / numberOfFights)
    const startAt = new Date().toISOString()

    const { data: t, error: tErr } = await supabase.from('arena_tournaments').insert({
      status: 'active',
      start_at: startAt,
      fight_duration_seconds: fightDuration,
      player_ids: playerIds,
      bracket_size: bracketSize,
      seed,
    }).select().single()
    if (tErr) throw new Error(tErr.message)

    const bracketFights = generateBracket(seed, playerIds)
    const sheetsMap = {}
    for (const pid of playerIds) sheetsMap[pid] = sheets.value[pid] || {}
    const resolved = resolveBracket(seed, bracketFights, sheetsMap)

    // fight_order chronologique : tous les round 1 d'abord, puis round 2, etc.
    const tStart = new Date(startAt).getTime()
    const sorted = [...resolved].sort((a, b) => a.round - b.round || a.bracket_position - b.bracket_position)
    const fightRows = sorted.map((f, idx) => ({
      tournament_id: t.id,
      round: f.round,
      bracket_position: f.bracket_position,
      player_a_id: f.player_a_id,
      player_b_id: f.player_b_id,
      scheduled_start_at: new Date(tStart + idx * fightDuration * 1000).toISOString(),
      winner_id: f.winner_id,
    }))
    const { error: fErr } = await supabase.from('arena_fights').insert(fightRows)
    if (fErr) throw new Error(fErr.message)

    await fetchCurrentTournament()
    return true
  }

  async function finalizeTournamentIfDone() {
    const t = currentTournament.value
    if (!t || t.status !== 'active' || t.finalized_at) return
    const allFights = currentFights.value
    if (!allFights.length) return

    const now = new Date()
    const lastFight = [...allFights].sort((a, b) => new Date(b.scheduled_start_at) - new Date(a.scheduled_start_at))[0]
    const lastEnd = new Date(new Date(lastFight.scheduled_start_at).getTime() + t.fight_duration_seconds * 1000)
    if (now < lastEnd) return

    const maxRound = Math.max(...allFights.map(f => f.round))
    const finalFight = allFights.find(f => f.round === maxRound)
    if (!finalFight?.winner_id) return

    const { error: tErr } = await supabase
      .from('arena_tournaments')
      .update({ status: 'finished', winner_id: finalFight.winner_id, finalized_at: new Date().toISOString() })
      .eq('id', t.id)
      .is('finalized_at', null)
    if (tErr) { console.warn('Finalize:', tErr.message); return }

    await incrementRating(finalFight.winner_id, { tournaments_won: 1 })

    const fightWinners = {}
    for (const f of allFights) fightWinners[f.id] = f.winner_id
    const correctBets = currentBets.value.filter(b => b.picked_winner_id === fightWinners[b.fight_id])
    const byBettor = {}
    for (const b of correctBets) byBettor[b.bettor_id] = (byBettor[b.bettor_id] || 0) + 1
    for (const [bettorId, count] of Object.entries(byBettor)) {
      await incrementRating(bettorId, { correct_bets: count })
    }

    await fetchCurrentTournament()
    await fetchRatings()
  }

  async function incrementRating(profileId, deltas) {
    const { data: ex } = await supabase.from('arena_ratings').select('*').eq('profile_id', profileId).maybeSingle()
    if (ex) {
      const patch = { updated_at: new Date().toISOString() }
      if (deltas.tournaments_won) patch.tournaments_won = (ex.tournaments_won || 0) + deltas.tournaments_won
      if (deltas.correct_bets) patch.correct_bets = (ex.correct_bets || 0) + deltas.correct_bets
      await supabase.from('arena_ratings').update(patch).eq('id', ex.id)
    } else {
      await supabase.from('arena_ratings').insert({
        profile_id: profileId,
        elo: 1000,
        wins: 0,
        losses: 0,
        streak: 0,
        tournaments_won: deltas.tournaments_won || 0,
        correct_bets: deltas.correct_bets || 0,
      })
    }
  }

  // ═══════════════════════════════════════════════════════════
  async function placeBet(fightId, pickedWinnerId) {
    const pid = getProfileId()
    if (!pid) throw new Error('Non connecté')
    const fight = currentFights.value.find(f => f.id === fightId)
    if (!fight) throw new Error('Combat introuvable')
    if (new Date() >= new Date(fight.scheduled_start_at)) throw new Error('Paris clos : combat commencé')
    if (fight.player_a_id === pid || fight.player_b_id === pid) throw new Error('Vous êtes participant')

    const { error } = await supabase.from('arena_bets').upsert(
      { fight_id: fightId, bettor_id: pid, picked_winner_id: pickedWinnerId },
      { onConflict: 'fight_id,bettor_id' }
    )
    if (error) throw new Error(error.message)
    await fetchFightsAndBets(currentTournament.value.id)
  }

  async function cancelBet(fightId) {
    const pid = getProfileId()
    if (!pid) return
    const fight = currentFights.value.find(f => f.id === fightId)
    if (fight && new Date() >= new Date(fight.scheduled_start_at)) throw new Error('Trop tard')
    await supabase.from('arena_bets').delete().eq('fight_id', fightId).eq('bettor_id', pid)
    await fetchFightsAndBets(currentTournament.value.id)
  }

  // ═══════════════════════════════════════════════════════════
  async function forceNewTournament() {
    if (currentTournament.value?.status === 'active') {
      await supabase
        .from('arena_tournaments')
        .update({ status: 'finished', finalized_at: new Date().toISOString() })
        .eq('id', currentTournament.value.id)
    }
    await fetchCurrentTournament()
    return maybeStartNewTournament()
  }

  // Accélère le tournoi en cours : marque le tournoi comme terminé et finalise directement
  // (attribue points au vainqueur + paris corrects), sans attendre que le temps s'écoule.
  async function endTournamentNow() {
    const t = currentTournament.value
    if (!t || t.status !== 'active') throw new Error('Aucun tournoi actif')

    // 1) Récupère les fights frais depuis la DB
    const { data: fights, error: fErr } = await supabase
      .from('arena_fights')
      .select('*')
      .eq('tournament_id', t.id)
      .order('round', { ascending: false })
    if (fErr) throw new Error('Fetch fights: ' + fErr.message)
    if (!fights?.length) throw new Error('Aucun combat dans ce tournoi')

    const maxRound = Math.max(...fights.map(f => f.round))
    const finalFight = fights.find(f => f.round === maxRound)
    if (!finalFight?.winner_id) throw new Error('Pas de vainqueur d\u00e9termin\u00e9 dans la finale')

    // 2) Avance scheduled_start_at + durée = 1s (pour que l'UI affiche immédiatement la fin)
    const pastIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    await supabase.from('arena_fights').update({ scheduled_start_at: pastIso }).eq('tournament_id', t.id)

    // 3) Bets pour comptabiliser les paris corrects
    const fightIds = fights.map(f => f.id)
    const { data: bets } = await supabase.from('arena_bets').select('*').in('fight_id', fightIds)
    const fightWinners = {}
    for (const f of fights) fightWinners[f.id] = f.winner_id
    const correctBets = (bets || []).filter(b => b.picked_winner_id === fightWinners[b.fight_id])
    const byBettor = {}
    for (const b of correctBets) byBettor[b.bettor_id] = (byBettor[b.bettor_id] || 0) + 1

    // 4) Marque le tournoi comme terminé
    const { error: tErr, data: updated } = await supabase
      .from('arena_tournaments')
      .update({
        status: 'finished',
        fight_duration_seconds: 1,
        winner_id: finalFight.winner_id,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', t.id)
      .is('finalized_at', null)
      .select()
    if (tErr) throw new Error('Update tournoi: ' + tErr.message)

    // Si updated est vide, c'est qu'un autre client a déjà finalisé — on s'arrête proprement
    if (!updated || updated.length === 0) {
      await fetchCurrentTournament()
      await fetchRatings()
      return
    }

    // 5) Attribue les points (+100 au vainqueur, +10 par pari correct)
    try { await incrementRating(finalFight.winner_id, { tournaments_won: 1 }) } catch (e) { console.warn('Winner rating:', e.message) }
    for (const [bettorId, count] of Object.entries(byBettor)) {
      try { await incrementRating(bettorId, { correct_bets: count }) } catch (e) { console.warn('Bet rating:', e.message) }
    }

    await fetchCurrentTournament()
    await fetchRatings()
  }

  // Reset complet du classement arena_ratings
  async function resetLeaderboard() {
    const { data, error } = await supabase
      .from('arena_ratings')
      .delete()
      .neq('profile_id', '00000000-0000-0000-0000-000000000000')
      .select()
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error('Aucune ligne supprim\u00e9e (v\u00e9rifiez les RLS policies Supabase pour les admins)')
    }
    await fetchRatings()
  }

  async function init() {
    loading.value = true
    await Promise.all([fetchPool(), fetchCurrentTournament(), fetchRatings()])
    try { await maybeStartNewTournament() } catch (e) { console.warn('auto-start:', e.message) }
    try { await finalizeTournamentIfDone() } catch (e) { console.warn('auto-finalize:', e.message) }
    loading.value = false
  }

  return {
    pool, currentTournament, currentFights, currentBets, ratings, sheets, loading,
    myBetsByFight,
    TOURNAMENT_DURATION_HOURS, POINTS_WINNER, POINTS_BET_CORRECT,
    fetchPool, fetchRatings, fetchCurrentTournament,
    addToPool, removeFromPool, searchProfiles,
    maybeStartNewTournament, finalizeTournamentIfDone, forceNewTournament,
    endTournamentNow, resetLeaderboard,
    placeBet, cancelBet,
    computeMaxHp,
    init,
  }
})
