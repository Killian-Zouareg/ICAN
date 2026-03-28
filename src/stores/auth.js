import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profiles = ref([])
  const activeProfile = ref(null)
  const loading = ref(true)

  const isAdmin = computed(() => activeProfile.value?.is_admin === true)
  const isAuthenticated = computed(() => !!user.value)
  // Keep backward compat — components use auth.profile
  const profile = computed(() => activeProfile.value)

  async function fetchProfiles() {
    if (!user.value) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('owner_id', user.value.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erreur fetchProfiles:', error.message)
      profiles.value = []
      return
    }

    profiles.value = data || []

    if (profiles.value.length === 0) {
      // No profile — create default from auth metadata
      const meta = user.value.user_metadata || {}
      const username = meta.username || user.value.email.split('@')[0]
      const displayName = meta.display_name || username
      const { data: created } = await supabase
        .from('profiles')
        .insert({ owner_id: user.value.id, username, display_name: displayName })
        .select()
        .maybeSingle()
      if (created) {
        profiles.value = [created]
      }
    }

    // Restore last active profile from localStorage, or use first
    const savedProfileId = localStorage.getItem('ican_active_profile')
    const saved = profiles.value.find((p) => p.id === savedProfileId)
    activeProfile.value = saved || profiles.value[0] || null
  }

  function switchProfile(profileId) {
    const found = profiles.value.find((p) => p.id === profileId)
    if (found) {
      activeProfile.value = found
      localStorage.setItem('ican_active_profile', profileId)
    }
  }

  async function createProfile(username, displayName) {
    if (!user.value) return
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        owner_id: user.value.id,
        username,
        display_name: displayName || username,
      })
      .select()
      .single()
    if (error) throw error
    profiles.value.push(data)
    return data
  }

  async function deleteProfile(profileId) {
    if (profiles.value.length <= 1) {
      throw new Error('Tu dois garder au moins un profil')
    }
    const { error } = await supabase.from('profiles').delete().eq('id', profileId)
    if (error) throw error
    profiles.value = profiles.value.filter((p) => p.id !== profileId)
    if (activeProfile.value?.id === profileId) {
      activeProfile.value = profiles.value[0]
      localStorage.setItem('ican_active_profile', activeProfile.value.id)
    }
  }

  async function updateProfile(profileId, { username, displayName, avatarUrl }) {
    const updates = {}
    if (username !== undefined) updates.username = username
    if (displayName !== undefined) updates.display_name = displayName
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId)
      .select()
      .single()
    if (error) throw error

    // Update in local list
    const idx = profiles.value.findIndex((p) => p.id === profileId)
    if (idx !== -1) profiles.value[idx] = data
    if (activeProfile.value?.id === profileId) activeProfile.value = data
    return data
  }

  async function uploadAvatar(profileId, file) {
    if (!user.value) return
    const ext = file.name.split('.').pop()
    const path = `${profileId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = data.publicUrl + '?t=' + Date.now()

    await updateProfile(profileId, { avatarUrl: publicUrl })
    return publicUrl
  }

  async function signUp(email, password, username, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName || username,
        },
      },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    clearState()
  }

  function clearState() {
    user.value = null
    profiles.value = []
    activeProfile.value = null
    localStorage.removeItem('ican_active_profile')
  }

  function isTokenExpired(session) {
    if (!session?.expires_at) return true
    // expires_at is in seconds since epoch
    return session.expires_at * 1000 < Date.now()
  }

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Try to refresh the session
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && refreshed.session) {
          // Refresh succeeded — use the new session
          user.value = refreshed.session.user
          await fetchProfiles()
        } else if (!isTokenExpired(session)) {
          // Refresh failed but the access token is still valid (temporary network issue?)
          user.value = session.user
          await fetchProfiles()
        } else {
          // Both refresh failed AND token is expired — session is dead, clean logout
          console.warn('Session expir\u00e9e, d\u00e9connexion')
          clearState()
          await supabase.auth.signOut().catch(() => {})
        }
      }
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        user.value = session?.user ?? null
        if (user.value) {
          try { await fetchProfiles() } catch (e) { console.error('fetchProfiles error:', e) }
        }
      } else if (event === 'TOKEN_REFRESHED') {
        user.value = session?.user ?? null
      } else if (event === 'SIGNED_OUT') {
        clearState()
      }
    })
  }

  return {
    user,
    profiles,
    activeProfile,
    profile,
    loading,
    isAdmin,
    isAuthenticated,
    fetchProfiles,
    switchProfile,
    createProfile,
    deleteProfile,
    updateProfile,
    uploadAvatar,
    signUp,
    signIn,
    signOut,
    init,
  }
})
