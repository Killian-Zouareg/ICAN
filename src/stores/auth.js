import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)

  const isAdmin = computed(() => profile.value?.is_admin === true)
  const isAuthenticated = computed(() => !!user.value)

  async function fetchProfile() {
    if (!user.value) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .maybeSingle()

    if (error) {
      console.error('Erreur fetchProfile:', error.message)
      profile.value = null
      return
    }

    if (!data) {
      // Profile missing — create it from auth metadata
      const meta = user.value.user_metadata || {}
      const username = meta.username || user.value.email.split('@')[0]
      const displayName = meta.display_name || username
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.value.id, username, display_name: displayName })
        .select()
        .maybeSingle()
      profile.value = created
      return
    }

    profile.value = data
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

  async function updateProfile({ username, displayName, avatarUrl }) {
    if (!user.value) return
    const updates = {}
    if (username !== undefined) updates.username = username
    if (displayName !== undefined) updates.display_name = displayName
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.value.id)
      .select()
      .single()
    if (error) throw error
    profile.value = data
  }

  async function uploadAvatar(file) {
    if (!user.value) return
    const ext = file.name.split('.').pop()
    const path = `${user.value.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = data.publicUrl + '?t=' + Date.now()

    await updateProfile({ avatarUrl: publicUrl })
    return publicUrl
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
    profile.value = null
  }

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      }
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
  }

  return {
    user,
    profile,
    loading,
    isAdmin,
    isAuthenticated,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    signUp,
    signIn,
    signOut,
    init,
  }
})
