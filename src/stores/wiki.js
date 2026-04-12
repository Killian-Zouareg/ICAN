import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { checkRateLimit } from '../lib/rateLimit'

export const useWikiStore = defineStore('wiki', () => {
  const heroes = ref([])
  const currentHero = ref(null)
  const loading = ref(false)
  const saving = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_heroes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      heroes.value = data || []
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_heroes')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      currentHero.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function create(fields) {
    saving.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_heroes')
        .insert(fields)
        .select()
        .single()
      if (error) throw error
      heroes.value.push(data)
      return data
    } finally {
      saving.value = false
    }
  }

  async function update(id, fields) {
    saving.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_heroes')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const idx = heroes.value.findIndex(h => h.id === id)
      if (idx !== -1) heroes.value[idx] = data
      if (currentHero.value?.id === id) currentHero.value = data
      return data
    } finally {
      saving.value = false
    }
  }

  async function remove(id) {
    const { error } = await supabase
      .from('wiki_heroes')
      .delete()
      .eq('id', id)
    if (error) throw error
    heroes.value = heroes.value.filter(h => h.id !== id)
    if (currentHero.value?.id === id) currentHero.value = null
  }

  async function uploadPhoto(id, file) {
    const msg = checkRateLimit('upload')
    if (msg) throw new Error(msg)

    const ext = file.name.split('.').pop()
    const path = `wiki/${id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) throw upErr

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    await update(id, { photo_url: publicUrl })
    return publicUrl
  }

  return {
    heroes, currentHero, loading, saving,
    fetchAll, fetchOne, create, update, remove, uploadPhoto,
  }
})
