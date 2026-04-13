import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

/**
 * Combat : jet de dé 1-100 pour chaque joueur.
 * Les stats iCharacter ajoutent un petit bonus (somme des 5 stats, max 25 → bonus max ~12).
 * Le plus haut score gagne.
 */
export function resolveFightLogic(challengerSheet, opponentSheet) {
  const cStats = ['force', 'vigueur', 'mobilite', 'intelligence', 'charisme']
    .reduce((sum, s) => sum + (challengerSheet?.[s] || 0), 0)
  const oStats = cStats ? ['force', 'vigueur', 'mobilite', 'intelligence', 'charisme']
    .reduce((sum, s) => sum + (opponentSheet?.[s] || 0), 0) : 0

  // Bonus = moitié de la somme des stats (max 12 sur un jet de 1-100)
  const cBonus = Math.floor(cStats / 2)
  const oBonus = Math.floor(oStats / 2)

  const cRoll = Math.floor(Math.random() * 100) + 1
  const oRoll = Math.floor(Math.random() * 100) + 1

  const cTotal = cRoll + cBonus
  const oTotal = oRoll + oBonus

  const winner = cTotal > oTotal ? 'challenger' : cTotal < oTotal ? 'opponent' : (Math.random() > 0.5 ? 'challenger' : 'opponent')

  return {
    challenger: { roll: cRoll, bonus: cBonus, total: cTotal },
    opponent: { roll: oRoll, bonus: oBonus, total: oTotal },
    winner,
  }
}

export const useArenaStore = defineStore('arena', () => {
  const fights = ref([])
  const pendingChallenges = ref([])
  const ratings = ref([])
  const myRating = ref(null)
  const loading = ref(false)

  function getProfileId() {
    return useAuthStore().activeProfile?.id
  }

  async function fetchRatings() {
    const { data } = await supabase
      .from('arena_ratings')
      .select('*, profiles(display_name, avatar_url, username)')
      .order('elo', { ascending: false })
      .limit(20)
    ratings.value = data || []
    const pid = getProfileId()
    if (pid) myRating.value = (data || []).find(r => r.profile_id === pid) || null
  }

  async function fetchMyFights() {
    const pid = getProfileId()
    if (!pid) return
    const { data } = await supabase
      .from('arena_fights')
      .select('*, challenger:profiles!arena_fights_challenger_id_fkey(id, display_name, avatar_url), opponent:profiles!arena_fights_opponent_id_fkey(id, display_name, avatar_url)')
      .or(`challenger_id.eq.${pid},opponent_id.eq.${pid}`)
      .in('status', ['resolved', 'declined'])
      .order('created_at', { ascending: false })
      .limit(30)
    fights.value = data || []
  }

  async function fetchPending() {
    const pid = getProfileId()
    if (!pid) return
    const { data } = await supabase
      .from('arena_fights')
      .select('*, challenger:profiles!arena_fights_challenger_id_fkey(id, display_name, avatar_url)')
      .eq('opponent_id', pid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    pendingChallenges.value = data || []
  }

  async function createChallenge(opponentId) {
    const pid = getProfileId()
    if (!pid) throw new Error('Non connecté')
    if (pid === opponentId) throw new Error('Tu ne peux pas te défier toi-même')

    const { error } = await supabase
      .from('arena_fights')
      .insert({ challenger_id: pid, opponent_id: opponentId })
    if (error) throw new Error(error.message)
  }

  async function acceptChallenge(fightId) {
    const pid = getProfileId()
    const { data: fight } = await supabase.from('arena_fights').select('*').eq('id', fightId).single()
    if (!fight || fight.status !== 'pending' || fight.opponent_id !== pid) throw new Error('Défi invalide')

    // Fetch stats
    const { data: cSheet } = await supabase.from('character_sheets').select('force, vigueur, mobilite, intelligence, charisme').eq('profile_id', fight.challenger_id).maybeSingle()
    const { data: oSheet } = await supabase.from('character_sheets').select('force, vigueur, mobilite, intelligence, charisme').eq('profile_id', fight.opponent_id).maybeSingle()

    const result = resolveFightLogic(cSheet, oSheet)
    const winnerId = result.winner === 'challenger' ? fight.challenger_id : fight.opponent_id

    await supabase.from('arena_fights').update({
      status: 'resolved',
      challenger_score: result.challenger.total,
      opponent_score: result.opponent.total,
      winner_id: winnerId,
      fight_log: result,
      resolved_at: new Date().toISOString(),
    }).eq('id', fightId)

    await updateElo(winnerId, winnerId === fight.challenger_id ? fight.opponent_id : fight.challenger_id)
    await Promise.all([fetchPending(), fetchMyFights(), fetchRatings()])
    return { ...result, winnerId }
  }

  async function declineChallenge(fightId) {
    const { data: fight } = await supabase.from('arena_fights').select('*').eq('id', fightId).single()
    if (!fight) throw new Error('Défi introuvable')
    await supabase.from('arena_fights').update({ status: 'declined' }).eq('id', fightId)
    await fetchPending()
  }

  async function updateElo(winnerId, loserId) {
    for (const [pid, won] of [[winnerId, true], [loserId, false]]) {
      const { data: ex } = await supabase.from('arena_ratings').select('*').eq('profile_id', pid).maybeSingle()
      if (ex) {
        await supabase.from('arena_ratings').update({
          elo: Math.max(0, ex.elo + (won ? 25 : -25)),
          wins: ex.wins + (won ? 1 : 0),
          losses: ex.losses + (won ? 0 : 1),
          streak: won ? (ex.streak > 0 ? ex.streak + 1 : 1) : (ex.streak < 0 ? ex.streak - 1 : -1),
          updated_at: new Date().toISOString(),
        }).eq('id', ex.id)
      } else {
        await supabase.from('arena_ratings').insert({
          profile_id: pid, elo: won ? 1025 : 975,
          wins: won ? 1 : 0, losses: won ? 0 : 1, streak: won ? 1 : -1,
        })
      }
    }
  }

  async function searchPlayers(query) {
    const pid = getProfileId()
    let q = supabase.from('profiles').select('id, display_name, avatar_url, username').neq('id', pid).limit(15)
    if (query) q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
    const { data } = await q.order('display_name')
    return data || []
  }

  return {
    fights, pendingChallenges, ratings, myRating, loading,
    fetchRatings, fetchMyFights, fetchPending, createChallenge,
    acceptChallenge, declineChallenge, searchPlayers,
  }
})
