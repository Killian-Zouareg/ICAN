import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const SHARE_DURATIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 heure' },
  { minutes: 60 * 8, label: '8 heures' },
  { minutes: 60 * 24, label: '24 heures' },
]

export const useUserTokenStore = defineStore('userToken', () => {
  // Map<owner_id, { id, owner_id, lat, lng, updated_at, profile? }>
  const tokens = ref(new Map())
  // Map<share_id, share row + owner profile>
  const shares = ref(new Map())
  const loading = ref(false)
  let channel = null
  // bump every second so timers re-render
  const nowTick = ref(Date.now())
  let tickInterval = null

  const myToken = computed(() => {
    const auth = useAuthStore()
    const pid = auth.activeProfile?.id
    if (!pid) return null
    return tokens.value.get(pid) || null
  })

  const activeShares = computed(() => {
    const now = nowTick.value
    return [...shares.value.values()].filter(
      (s) => new Date(s.expires_at).getTime() > now
    )
  })

  const myActiveShares = computed(() => {
    const auth = useAuthStore()
    const pid = auth.activeProfile?.id
    if (!pid) return []
    return activeShares.value.filter((s) => s.owner_id === pid)
  })

  function getShare(shareId) {
    return shares.value.get(shareId) || null
  }

  function getTokenForOwner(ownerId) {
    return tokens.value.get(ownerId) || null
  }

  function isShareActive(shareId) {
    const s = shares.value.get(shareId)
    if (!s) return false
    return new Date(s.expires_at).getTime() > nowTick.value
  }

  async function fetchMyToken() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const { data, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('owner_id', auth.activeProfile.id)
      .maybeSingle()
    if (error) {
      console.warn('[userToken] fetchMyToken error:', error.message)
      return
    }
    if (data) {
      tokens.value.set(data.owner_id, { ...data })
      tokens.value = new Map(tokens.value)
    }
  }

  async function placeToken(lat, lng) {
    const auth = useAuthStore()
    if (!auth.activeProfile) throw new Error('Aucun profil actif')
    const row = {
      owner_id: auth.activeProfile.id,
      lat,
      lng,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('user_tokens')
      .upsert(row, { onConflict: 'owner_id' })
      .select()
      .single()
    if (error) throw error
    tokens.value.set(data.owner_id, { ...data })
    tokens.value = new Map(tokens.value)
    return data
  }

  // Charge tous les partages actifs visibles + tokens des owners associés.
  async function fetchActiveShares() {
    loading.value = true
    try {
      const nowIso = new Date().toISOString()
      const { data: shareRows, error } = await supabase
        .from('live_location_shares')
        .select('*, owner:profiles!live_location_shares_owner_id_fkey(id, username, display_name, avatar_url, is_hero, hero_color_primary, hero_color_secondary)')
        .gt('expires_at', nowIso)
      if (error) {
        console.warn('[userToken] fetchActiveShares error:', error.message)
        return
      }
      const map = new Map()
      const ownerIds = new Set()
      for (const s of shareRows || []) {
        map.set(s.id, s)
        ownerIds.add(s.owner_id)
      }
      shares.value = map

      // Fetch owner tokens (sauf le notre, déjà chargé)
      const auth = useAuthStore()
      const myPid = auth.activeProfile?.id
      const idsToFetch = [...ownerIds].filter((id) => id !== myPid)
      if (idsToFetch.length > 0) {
        const { data: tokenRows } = await supabase
          .from('user_tokens')
          .select('*')
          .in('owner_id', idsToFetch)
        const next = new Map(tokens.value)
        for (const t of tokenRows || []) {
          next.set(t.owner_id, t)
        }
        tokens.value = next
      }
    } finally {
      loading.value = false
    }
  }

  // durationMinutes + target = { type: 'post'|'dm', conversationId? }
  // Pour les posts, on insère sans post_id (post_id est lié après création du post via attachShareToPost).
  async function createShare({ durationMinutes, target }) {
    const auth = useAuthStore()
    if (!auth.activeProfile) throw new Error('Aucun profil actif')
    if (!myToken.value) throw new Error('Place ton token sur la carte avant de partager')
    if (!durationMinutes || durationMinutes <= 0) throw new Error('Durée invalide')

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    const row = {
      owner_id: auth.activeProfile.id,
      shared_in: target.type,
      expires_at: expiresAt,
    }
    if (target.type === 'dm') {
      if (!target.conversationId) throw new Error('Conversation requise')
      row.conversation_id = target.conversationId
    }
    const { data, error } = await supabase
      .from('live_location_shares')
      .insert(row)
      .select('*, owner:profiles!live_location_shares_owner_id_fkey(id, username, display_name, avatar_url, is_hero, hero_color_primary, hero_color_secondary)')
      .single()
    if (error) throw error
    shares.value.set(data.id, data)
    shares.value = new Map(shares.value)
    return data
  }

  async function attachShareToPost(shareId, postId) {
    const { error } = await supabase
      .from('live_location_shares')
      .update({ post_id: postId })
      .eq('id', shareId)
    if (error) throw error
    const existing = shares.value.get(shareId)
    if (existing) {
      shares.value.set(shareId, { ...existing, post_id: postId })
      shares.value = new Map(shares.value)
    }
  }

  async function stopShare(shareId) {
    const { error } = await supabase
      .from('live_location_shares')
      .delete()
      .eq('id', shareId)
    if (error) throw error
    shares.value.delete(shareId)
    shares.value = new Map(shares.value)
  }

  // Récupère un share par id si pas déjà en cache (utile pour les posts visibles avec un live_share_id).
  async function ensureShare(shareId) {
    if (!shareId) return null
    if (shares.value.has(shareId)) return shares.value.get(shareId)
    const { data, error } = await supabase
      .from('live_location_shares')
      .select('*, owner:profiles!live_location_shares_owner_id_fkey(id, username, display_name, avatar_url, is_hero, hero_color_primary, hero_color_secondary)')
      .eq('id', shareId)
      .maybeSingle()
    if (error || !data) return null
    shares.value.set(data.id, data)
    shares.value = new Map(shares.value)
    if (!tokens.value.has(data.owner_id)) {
      const { data: tok } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('owner_id', data.owner_id)
        .maybeSingle()
      if (tok) {
        tokens.value.set(tok.owner_id, tok)
        tokens.value = new Map(tokens.value)
      }
    }
    return data
  }

  function start() {
    stop()
    channel = supabase.channel('user-tokens-' + Date.now())
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_tokens',
    }, (payload) => {
      const row = payload.new || payload.old
      if (!row) return
      if (payload.eventType === 'DELETE') {
        tokens.value.delete(row.owner_id)
        tokens.value = new Map(tokens.value)
      } else {
        tokens.value.set(row.owner_id, { ...row })
        tokens.value = new Map(tokens.value)
      }
    })
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_location_shares',
    }, async (payload) => {
      const row = payload.new || payload.old
      if (!row) return
      if (payload.eventType === 'DELETE') {
        shares.value.delete(row.id)
        shares.value = new Map(shares.value)
      } else {
        // Recharge la share avec profil joint (le payload realtime n'a pas le join)
        const { data } = await supabase
          .from('live_location_shares')
          .select('*, owner:profiles!live_location_shares_owner_id_fkey(id, username, display_name, avatar_url, is_hero, hero_color_primary, hero_color_secondary)')
          .eq('id', row.id)
          .maybeSingle()
        if (data) {
          shares.value.set(data.id, data)
          shares.value = new Map(shares.value)
        }
      }
    })
    channel.subscribe()

    if (!tickInterval) {
      tickInterval = setInterval(() => {
        nowTick.value = Date.now()
      }, 1000)
    }
  }

  async function stop() {
    if (channel) {
      const c = channel
      channel = null
      await supabase.removeChannel(c)
    }
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  function reset() {
    tokens.value = new Map()
    shares.value = new Map()
  }

  return {
    tokens,
    shares,
    loading,
    nowTick,
    myToken,
    activeShares,
    myActiveShares,
    fetchMyToken,
    placeToken,
    fetchActiveShares,
    createShare,
    attachShareToPost,
    stopShare,
    ensureShare,
    getShare,
    getTokenForOwner,
    isShareActive,
    start,
    stop,
    reset,
  }
})
