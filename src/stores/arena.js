import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { resolveSwiss, computeStandings, swissRoundsFor, computeMaxHp, simulateFight, nextPowerOfTwo, resolveTopCutBracket } from '../lib/arenaFight'
import { hashSeed } from '../lib/seededRandom'

const TOURNAMENT_DURATION_HOURS = 10
const POINTS_WINNER = 100
const POINTS_BET_CORRECT = 10
const POINTS_SUPPORT_CORRECT = 5
// Chaque soutien ajoute +2 au max des jets du soutenu (attaque + défense),
// ce qui améliore statistiquement ses chances sans être déterministe.
const ROLL_BONUS_PER_SUPPORTER = 2
// Pause minimale entre 2 tournois pour afficher l'écran vainqueur
const INTER_TOURNAMENT_PAUSE_SECONDS = 30

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000)
}


export const useArenaStore = defineStore('arena', () => {
  const pool = ref([])
  const currentTournament = ref(null)
  const currentFights = ref([])
  const currentBets = ref([])
  const currentSupports = ref([])
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

  // ═════════════════════════════════════════════════════════════════════════
  // PRÉDICTIONS — pas de winner_id pré-écrit en DB, on simule tout à la volée
  // en fonction des stats + soutiens actuels. Figé dans la DB uniquement
  // quand un combat démarre (via persistDueFights).
  // ═════════════════════════════════════════════════════════════════════════
  const predictionMap = computed(() => {
    const t = currentTournament.value
    if (!t?.player_ids?.length || !t.seed) return {}
    const n = t.player_ids.length
    const swissRounds = swissRoundsFor(n)
    const sheetsMap = {}
    const bonuses = {}
    for (const pid of t.player_ids) {
      sheetsMap[pid] = sheets.value[pid] || {}
      bonuses[pid] = (supportCountsByFighter.value[pid] || 0) * ROLL_BONUS_PER_SUPPORTER
    }
    const swiss = resolveSwiss(t.seed, t.player_ids, sheetsMap, bonuses, swissRounds)
    const bracket = n >= 4
      ? resolveTopCutBracket(t.seed, swiss.standings, sheetsMap, bonuses, swissRounds)
      : { fights: [], winner_id: swiss.winner_id }
    const all = [...swiss.fights, ...bracket.fights]
    const map = {}
    for (const f of all) {
      map[`${f.round}:${f.bracket_position}`] = {
        player_a_id: f.player_a_id,
        player_b_id: f.player_b_id,
        winner_id: f.winner_id,
        is_bye: f.is_bye,
      }
    }
    return map
  })

  // Fights avec DB-data + prédictions pour les champs manquants (winner/participants)
  const resolvedFights = computed(() => {
    const preds = predictionMap.value
    return currentFights.value.map(f => {
      const p = preds[`${f.round}:${f.bracket_position}`] || {}
      return {
        ...f,
        player_a_id: f.player_a_id ?? p.player_a_id ?? null,
        player_b_id: f.player_b_id ?? p.player_b_id ?? null,
        winner_id: f.winner_id ?? p.winner_id ?? null,
      }
    })
  })

  // Classement Swiss en direct (seulement fights terminés). On filtre aux rondes Swiss uniquement
  // (exclut le bracket top-cut qui n'entre pas dans le classement).
  const currentStandings = computed(() => {
    const t = currentTournament.value
    if (!t?.player_ids?.length) return []
    const nowMs = Date.now()
    const fightDurMs = (t.fight_duration_seconds || 0) * 1000
    const swissRounds = swissRoundsFor(t.player_ids.length)
    const doneFights = resolvedFights.value.filter(f => {
      if (f.round > swissRounds) return false
      const end = new Date(f.scheduled_start_at).getTime() + fightDurMs
      return nowMs >= end
    })
    return computeStandings(t.player_ids, doneFights, swissRounds).standings
  })

  // Détermine le vainqueur du tournoi : si ≥4 joueurs, winner de la finale du bracket top-cut.
  // Sinon, tête du classement Swiss.
  function getTournamentWinner(tournament, allFights) {
    const n = tournament?.player_ids?.length || 0
    if (n >= 4) {
      const swissRounds = swissRoundsFor(n)
      const final = allFights.find(f => f.round === swissRounds + 3)
      if (final?.winner_id) return final.winner_id
    }
    return computeStandings(tournament?.player_ids || [], allFights, swissRoundsFor(n)).winner_id
  }

  // Totaux actuels de supporters par fighter (toute la durée du tournoi)
  const supportCountsByFighter = computed(() => {
    const map = {}
    for (const s of currentSupports.value) {
      map[s.fighter_id] = (map[s.fighter_id] || 0) + 1
    }
    return map
  })

  // Liste des supporters (avec profils) groupés par fighter, pour afficher les avatars sous chaque combattant
  const supportersByFighter = computed(() => {
    const map = {}
    for (const s of currentSupports.value) {
      if (!map[s.fighter_id]) map[s.fighter_id] = []
      map[s.fighter_id].push(s)
    }
    return map
  })

  // Mon soutien actuel (un seul par tournoi)
  const mySupport = computed(() => {
    const pid = getProfileId()
    if (!pid) return null
    return currentSupports.value.find(s => s.supporter_id === pid) || null
  })

  // Calcule le bonus de jet d'un combattant à l'instant t (supports créés avant un cutoff)
  // S'applique au max des jets de ce combattant (attaque + défense)
  function rollBonusFor(fighterId, cutoffIso) {
    if (!fighterId) return 0
    const cutoff = cutoffIso ? new Date(cutoffIso).getTime() : Date.now()
    let n = 0
    for (const s of currentSupports.value) {
      if (s.fighter_id !== fighterId) continue
      if (new Date(s.created_at).getTime() <= cutoff) n++
    }
    return n * ROLL_BONUS_PER_SUPPORTER
  }

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
      points_total:
        (r.tournaments_won || 0) * POINTS_WINNER +
        (r.correct_bets || 0) * POINTS_BET_CORRECT +
        (r.correct_supports || 0) * POINTS_SUPPORT_CORRECT,
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
      await fetchSupports(currentTournament.value.id)
      await fetchSheetsFor(currentTournament.value.player_ids || [])
    } else {
      currentFights.value = []
      currentBets.value = []
      currentSupports.value = []
    }
  }

  async function fetchSupports(tournamentId) {
    const { data } = await supabase
      .from('arena_supports')
      .select('*, profiles:supporter_id(id, display_name, username, avatar_url)')
      .eq('tournament_id', tournamentId)
      .order('created_at')
    currentSupports.value = data || []
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
  async function maybeStartNewTournament(opts = {}) {
    const last = currentTournament.value
    // Laisser une pause après la finalisation pour montrer le vainqueur (sauf si forcé)
    if (!opts.force && last?.status === 'finished' && last.finalized_at) {
      const elapsed = Date.now() - new Date(last.finalized_at).getTime()
      if (elapsed < INTER_TOURNAMENT_PAUSE_SECONDS * 1000) return false
    }
    const canStart = !last || last.status === 'finished'
    if (!canStart) return false

    // Refetch pool frais pour éviter toute incohérence avec la DB
    await fetchPool()
    const poolIds = pool.value.map(p => p.profile_id)
    if (poolIds.length < 2) {
      if (opts.force) throw new Error(`Pool trop petit : ${poolIds.length} joueur(s) \u2014 minimum 2 requis.`)
      return false
    }

    const playerIds = [...poolIds]
    await fetchSheetsFor(playerIds)

    const seed = randomSeed()
    const numRounds = swissRoundsFor(playerIds.length)
    const sheetsMap = {}
    for (const pid of playerIds) sheetsMap[pid] = sheets.value[pid] || {}

    // Résolution Swiss complète (pré-calcule toutes les rondes, déterministe)
    const resolved = resolveSwiss(seed, playerIds, sheetsMap, {}, numRounds)

    // Top-cut bracket : les 4 meilleurs du classement Swiss s'affrontent en demi-finales + finale.
    // Nécessite ≥4 joueurs pour faire un bracket, sinon le vainqueur du tournoi = #1 du classement Swiss.
    let bracketResult = { fights: [], winner_id: resolved.winner_id }
    if (playerIds.length >= 4) {
      bracketResult = resolveTopCutBracket(seed, resolved.standings, sheetsMap, {}, numRounds)
    }

    const allFights = [...resolved.fights, ...bracketResult.fights]

    // Nombre de combats réels (non-byes) pour étaler la durée
    const realFights = allFights.filter(f => !f.is_bye).length
    const fightDuration = Math.floor((TOURNAMENT_DURATION_HOURS * 3600) / Math.max(1, realFights))
    const startAt = new Date().toISOString()

    const { data: t, error: tErr } = await supabase.from('arena_tournaments').insert({
      status: 'active',
      start_at: startAt,
      fight_duration_seconds: fightDuration,
      player_ids: playerIds,
      // bracket_size = prochaine puissance de 2 (compat avec un ancien CHECK éventuel sur la DB)
      bracket_size: nextPowerOfTwo(playerIds.length),
      seed,
    }).select().single()
    if (tErr) throw new Error('Cr\u00e9ation tournoi : ' + tErr.message)

    // Planification : byes instantanés, combats réels enchaînés chronologiquement.
    // Les byes d'une ronde donnée sont placés au même instant que le 1er combat réel de cette ronde
    // pour que la ronde soit cohérente. Les combats du bracket top-cut suivent les rondes Swiss.
    // ⚠ On NE pré-écrit PAS winner_id : le vainqueur est calculé à la volée côté client à partir
    //   du seed + stats + soutiens, et persisté uniquement lorsque le combat démarre (persistDueFights).
    // ⚠ Les participants du bracket sont aussi null à la création (dérivés du classement Swiss prédit).
    const tStart = new Date(startAt).getTime()
    const sorted = [...allFights].sort((a, b) => a.round - b.round || a.bracket_position - b.bracket_position)
    let realIdx = 0
    const fightRows = sorted.map(f => {
      const isBye = !!f.is_bye
      const isBracket = f.round > numRounds
      const scheduled = new Date(tStart + realIdx * fightDuration * 1000).toISOString()
      if (!isBye) realIdx++
      return {
        tournament_id: t.id,
        round: f.round,
        bracket_position: f.bracket_position,
        // Bracket : participants null car dépendent du classement Swiss (prédiction). Swiss : fixés.
        player_a_id: isBracket ? null : f.player_a_id,
        player_b_id: isBracket ? null : f.player_b_id,
        scheduled_start_at: scheduled,
        winner_id: null, // jamais pré-écrit, persisté à scheduled_start_at via persistDueFights()
        is_bye: isBye,
      }
    })
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

    // S\u2019assurer que tous les combats dus sont fig\u00e9s en DB avant de finaliser
    await persistDueFights()

    // Vainqueur = gagnant de la finale du bracket top-cut (si ≥4 joueurs), sinon tête du classement Swiss.
    const tournamentWinnerId = getTournamentWinner(t, currentFights.value)
    if (!tournamentWinnerId) return

    const { error: tErr } = await supabase
      .from('arena_tournaments')
      .update({ status: 'finished', winner_id: tournamentWinnerId, finalized_at: new Date().toISOString() })
      .eq('id', t.id)
      .is('finalized_at', null)
    if (tErr) { console.warn('Finalize:', tErr.message); return }

    await incrementRating(tournamentWinnerId, { tournaments_won: 1 })

    const fightWinners = {}
    for (const f of currentFights.value) fightWinners[f.id] = f.winner_id
    const correctBets = currentBets.value.filter(b => b.picked_winner_id === fightWinners[b.fight_id])
    const byBettor = {}
    for (const b of correctBets) byBettor[b.bettor_id] = (byBettor[b.bettor_id] || 0) + 1
    for (const [bettorId, count] of Object.entries(byBettor)) {
      await incrementRating(bettorId, { correct_bets: count })
    }

    // Supports : +1 correct_support si le soutenu a gagné le tournoi
    const correctSupporters = currentSupports.value.filter(s => s.fighter_id === tournamentWinnerId)
    for (const s of correctSupporters) {
      await incrementRating(s.supporter_id, { correct_supports: 1 })
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
      if (deltas.correct_supports) patch.correct_supports = (ex.correct_supports || 0) + deltas.correct_supports
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
        correct_supports: deltas.correct_supports || 0,
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
  // SUPPORTS : les non-participants peuvent soutenir un combattant, +2 HP par soutien
  async function supportFighter(fighterId) {
    const pid = getProfileId()
    if (!pid) throw new Error('Non connect\u00e9')
    const t = currentTournament.value
    if (!t || t.status !== 'active') throw new Error('Aucun tournoi actif')
    const playerIds = t.player_ids || []
    if (playerIds.includes(pid)) throw new Error('Les participants ne peuvent pas soutenir')
    if (!playerIds.includes(fighterId)) throw new Error('Combattant invalide')

    // V\u00e9rification client : un seul soutien par tournoi, d\u00e9finitif (pas de switch ni d\u2019upsert)
    const existing = currentSupports.value.find(s => s.supporter_id === pid)
    if (existing) throw new Error('Vous avez d\u00e9j\u00e0 soutenu un combattant \u2014 le soutien est d\u00e9finitif.')

    const { error } = await supabase.from('arena_supports').insert(
      { tournament_id: t.id, supporter_id: pid, fighter_id: fighterId }
    )
    if (error) throw new Error(error.message)
    await fetchSupports(t.id)
    // Pas de recomputeUnlockedFights : rien n'est stock\u00e9 en DB \u00e0 re-simuler, la vue
    // r\u00e9agit au changement de supportCountsByFighter via predictionMap.
  }

  // Le soutien est d\u00e9finitif : on ne peut plus l\u2019annuler. Fonction conserv\u00e9e pour compat,
  // mais toujours bloqu\u00e9e c\u00f4t\u00e9 client.
  async function cancelSupport() {
    throw new Error('Le soutien est d\u00e9finitif \u2014 impossible \u00e0 retirer.')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // persistDueFights : écrit en DB les winner_id (et participants pour le bracket)
  // des combats dont le scheduled_start_at est passé. Idempotent, first-write-wins
  // via .is('winner_id', null) pour éviter les races entre clients.
  // Les combats non-dus ne sont JAMAIS persistés → pas de spoiler dans la DB.
  // ═════════════════════════════════════════════════════════════════════════
  async function persistDueFights() {
    const t = currentTournament.value
    if (!t || t.status !== 'active') return
    const preds = predictionMap.value
    if (!Object.keys(preds).length) return
    const nowMs = Date.now()
    const due = currentFights.value.filter(f =>
      f.winner_id == null && new Date(f.scheduled_start_at).getTime() <= nowMs
    )
    if (!due.length) return
    let wrote = 0
    for (const f of due) {
      const p = preds[`${f.round}:${f.bracket_position}`]
      if (!p || !p.winner_id) continue
      const patch = { winner_id: p.winner_id }
      if (f.player_a_id == null && p.player_a_id) patch.player_a_id = p.player_a_id
      if (f.player_b_id == null && p.player_b_id) patch.player_b_id = p.player_b_id
      const { data, error } = await supabase
        .from('arena_fights')
        .update(patch)
        .eq('id', f.id)
        .is('winner_id', null)
        .select()
      if (!error && data?.length) wrote++
    }
    if (wrote) await fetchFightsAndBets(t.id)
  }

  // Shim legacy (ancien nom) — remplacé par persistDueFights + predictionMap.
  async function recomputeUnlockedFights() {
    // No-op : on ne stocke plus de prédictions en DB.
  }

  // ═══════════════════════════════════════════════════════════
  async function forceNewTournament() {
    // 1) Vérifier le pool AVANT de toucher au tournoi en cours (évite un état
    // incohérent où on a marqué 'finished' puis échoué à créer le nouveau).
    await fetchPool()
    const poolIds = pool.value.map(p => p.profile_id)
    if (poolIds.length < 2) {
      throw new Error(`Pool trop petit : ${poolIds.length} joueur(s) \u2014 minimum 2 requis.`)
    }

    // 2) Marquer le tournoi actif courant comme terminé (si applicable)
    //    On utilise .select() pour détecter un échec silencieux RLS.
    if (currentTournament.value?.status === 'active') {
      const { data: updated, error: upErr } = await supabase
        .from('arena_tournaments')
        .update({ status: 'finished', finalized_at: new Date().toISOString() })
        .eq('id', currentTournament.value.id)
        .select()
      if (upErr) throw new Error('Cl\u00f4ture du tournoi actif : ' + upErr.message)
      if (!updated || updated.length === 0) {
        throw new Error('Impossible de cl\u00f4turer le tournoi actif : RLS bloque l\u2019UPDATE sur arena_tournaments. V\u00e9rifiez les policies admin.')
      }
    }
    await fetchCurrentTournament()

    // Sécurité : si après refetch le dernier tournoi est toujours 'active', on ne peut pas continuer
    if (currentTournament.value?.status === 'active') {
      throw new Error('Le tournoi pr\u00e9c\u00e9dent est toujours actif apr\u00e8s l\u2019UPDATE (incoh\u00e9rence DB / cache).')
    }

    // 3) Créer le nouveau tournoi (throw si DB refuse)
    const ok = await maybeStartNewTournament({ force: true })
    if (!ok) throw new Error('Impossible de d\u00e9marrer le tournoi (maybeStartNewTournament a retourn\u00e9 false sans raison identifi\u00e9e).')
    return true
  }

  // Accélère le tournoi en cours : marque le tournoi comme terminé et finalise directement
  // (attribue points au vainqueur + paris corrects), sans attendre que le temps s'écoule.
  async function endTournamentNow() {
    const t = currentTournament.value
    if (!t || t.status !== 'active') throw new Error('Aucun tournoi actif')

    // 1) Avance scheduled_start_at pour que tous les combats soient "dus" imm\u00e9diatement
    const pastIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    await supabase.from('arena_fights').update({ scheduled_start_at: pastIso }).eq('tournament_id', t.id)

    // 2) Recharge + persiste tous les winners (calcul\u00e9s \u00e0 la vol\u00e9e depuis seed + soutiens)
    await fetchFightsAndBets(t.id)
    await persistDueFights()

    // 3) R\u00e9cup\u00e8re les fights fig\u00e9s
    const { data: fights, error: fErr } = await supabase
      .from('arena_fights').select('*').eq('tournament_id', t.id)
    if (fErr) throw new Error('Fetch fights: ' + fErr.message)
    if (!fights?.length) throw new Error('Aucun combat dans ce tournoi')

    const tournamentWinnerId = getTournamentWinner(t, fights)
    if (!tournamentWinnerId) throw new Error('Pas de vainqueur d\u00e9termin\u00e9')

    // 4) Bets pour comptabiliser les paris corrects
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
        winner_id: tournamentWinnerId,
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

    // 5) Attribue les points (+100 au vainqueur, +10 par pari correct, +5 par soutien gagnant)
    try { await incrementRating(tournamentWinnerId, { tournaments_won: 1 }) } catch (e) { console.warn('Winner rating:', e.message) }
    for (const [bettorId, count] of Object.entries(byBettor)) {
      try { await incrementRating(bettorId, { correct_bets: count }) } catch (e) { console.warn('Bet rating:', e.message) }
    }
    // Supports du vainqueur
    const { data: supports } = await supabase.from('arena_supports').select('*').eq('tournament_id', t.id).eq('fighter_id', tournamentWinnerId)
    for (const s of supports || []) {
      try { await incrementRating(s.supporter_id, { correct_supports: 1 }) } catch (e) { console.warn('Support rating:', e.message) }
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
    try { await persistDueFights() } catch (e) { console.warn('auto-persist:', e.message) }
    try { await finalizeTournamentIfDone() } catch (e) { console.warn('auto-finalize:', e.message) }
    loading.value = false
  }

  return {
    pool, currentTournament, currentFights, currentBets, currentSupports, ratings, sheets, loading,
    myBetsByFight, supportCountsByFighter, supportersByFighter, mySupport, currentStandings,
    predictionMap, resolvedFights,
    TOURNAMENT_DURATION_HOURS, POINTS_WINNER, POINTS_BET_CORRECT, POINTS_SUPPORT_CORRECT, ROLL_BONUS_PER_SUPPORTER,
    fetchPool, fetchRatings, fetchCurrentTournament,
    addToPool, removeFromPool, searchProfiles,
    maybeStartNewTournament, finalizeTournamentIfDone, forceNewTournament,
    endTournamentNow, resetLeaderboard,
    placeBet, cancelBet,
    supportFighter, cancelSupport, rollBonusFor, recomputeUnlockedFights, persistDueFights,
    computeMaxHp,
    init,
  }
})
