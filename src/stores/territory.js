import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { checkRateLimit } from '../lib/rateLimit'

// Règles fixes par slot (points + maxPlayers)
export const SLOT_RULES = [
  { id: 'jackpot', points: 5, maxPlayers: 1, desc: '5 pts si seul', emoji: '🏛️', color: '#ffd700' },
  { id: 'risque', points: 3, maxPlayers: 2, desc: '3 pts si ≤ 2', emoji: '🏚️', color: '#e0245e' },
  { id: 'partage', points: 2, maxPlayers: 3, desc: '2 pts si ≤ 3', emoji: '🏠', color: '#1da1f2' },
  { id: 'refuge', points: 1, maxPlayers: 99, desc: '1 pt pour tous', emoji: '⛲', color: '#17bf63' },
]

export const PION_COLORS = ['#e0245e', '#1da1f2', '#17bf63', '#ffd700', '#f5a623', '#7b61ff', '#ff6b9d']

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export const useTerritoryStore = defineStore('territory', () => {
  const players = ref([])
  const votes = ref([])
  const leaderboard = ref([])
  const locations = ref([]) // from DB (name + image_url)
  const loading = ref(false)

  function getProfileId() {
    return useAuthStore().activeProfile?.id
  }

  // Merge DB locations with slot rules
  const mergedLocations = computed(() => {
    return SLOT_RULES.map(slot => {
      const dbLoc = locations.value.find(l => l.id === slot.id)
      return {
        ...slot,
        name: dbLoc?.name || slot.emoji,
        image_url: dbLoc?.image_url || null,
      }
    })
  })

  const myVoteToday = computed(() => {
    const pid = getProfileId()
    const today = getToday()
    return votes.value.find(v => v.profile_id === pid && v.day === today)
  })

  const todayVotes = computed(() => {
    const today = getToday()
    return votes.value.filter(v => v.day === today)
  })

  const todayRevealed = computed(() => {
    const today = getToday()
    const todayV = votes.value.filter(v => v.day === today)
    return todayV.length >= players.value.length && players.value.length > 0
  })

  async function fetchLocations() {
    const { data } = await supabase.from('territory_locations').select('*')
    locations.value = data || []
  }

  async function fetchPlayers() {
    const { data } = await supabase
      .from('territory_players')
      .select('*, profiles(id, display_name, avatar_url, username)')
      .order('created_at')
    players.value = data || []
  }

  async function fetchVotes() {
    const { data } = await supabase
      .from('territory_votes')
      .select('*')
      .order('day', { ascending: false })
      .limit(200)
    votes.value = data || []
  }

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('territory_scores')
      .select('*, profiles(display_name, avatar_url, username)')
      .order('total_points', { ascending: false })
    leaderboard.value = data || []
  }

  async function vote(locationId) {
    const pid = getProfileId()
    if (!pid) throw new Error('Non connecté')
    if (myVoteToday.value) throw new Error('Déjà voté aujourd\'hui')
    const today = getToday()

    const { error } = await supabase
      .from('territory_votes')
      .insert({ profile_id: pid, day: today, location_id: locationId })
    if (error) throw new Error(error.message)

    await fetchVotes()

    const todayV = votes.value.filter(v => v.day === today)
    if (todayV.length >= players.value.length && players.value.length > 0) {
      await resolveDay(today, todayV)
    }
  }

  async function resolveDay(day, dayVotes) {
    const counts = {}
    for (const slot of SLOT_RULES) counts[slot.id] = []
    for (const v of dayVotes) {
      if (counts[v.location_id]) counts[v.location_id].push(v.profile_id)
    }

    const pointsMap = {}
    for (const slot of SLOT_RULES) {
      const pids = counts[slot.id]
      if (pids.length > 0 && pids.length <= slot.maxPlayers) {
        for (const pid of pids) pointsMap[pid] = (pointsMap[pid] || 0) + slot.points
      }
    }

    for (const v of dayVotes) {
      const pts = pointsMap[v.profile_id] || 0
      const { data: ex } = await supabase.from('territory_scores').select('*').eq('profile_id', v.profile_id).maybeSingle()
      if (ex) {
        await supabase.from('territory_scores').update({
          total_points: ex.total_points + pts,
          days_played: ex.days_played + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', ex.id)
      } else {
        await supabase.from('territory_scores').insert({ profile_id: v.profile_id, total_points: pts, days_played: 1 })
      }
    }
    await fetchLeaderboard()
  }

  async function addPlayer(profileId) {
    const { error } = await supabase.from('territory_players').insert({ profile_id: profileId })
    if (error) throw new Error(error.message)
    await fetchPlayers()
  }

  async function removePlayer(profileId) {
    await supabase.from('territory_players').delete().eq('profile_id', profileId)
    await fetchPlayers()
  }

  async function updateLocationName(locId, name) {
    const { error } = await supabase.from('territory_locations').upsert({ id: locId, name, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    await fetchLocations()
  }

  async function uploadLocationImage(locId, file) {
    const msg = checkRateLimit('upload')
    if (msg) throw new Error(msg)
    const ext = file.name.split('.').pop()
    const path = `territory/${locId}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) throw upErr
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('territory_locations').upsert({ id: locId, image_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    await fetchLocations()
  }

  async function resetLeaderboard() {
    const { data, error } = await supabase.from('territory_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000').select()
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error('Aucune ligne supprimée (vérifiez les RLS policies Supabase pour les admins)')
    }
    await fetchLeaderboard()
  }

  async function resetVotes() {
    const { data, error } = await supabase.from('territory_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000').select()
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error('Aucune ligne supprimée (vérifiez les RLS policies Supabase pour les admins)')
    }
    await fetchVotes()
  }

  async function init() {
    loading.value = true
    await Promise.all([fetchLocations(), fetchPlayers(), fetchVotes(), fetchLeaderboard()])
    loading.value = false
  }

  return {
    players, votes, leaderboard, locations, loading,
    mergedLocations, myVoteToday, todayVotes, todayRevealed,
    fetchLocations, fetchPlayers, fetchVotes, fetchLeaderboard,
    vote, addPlayer, removePlayer, updateLocationName, uploadLocationImage,
    resetLeaderboard, resetVotes, init,
  }
})
