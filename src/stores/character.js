import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { checkRateLimit } from '../lib/rateLimit'
import { compressImage } from '../lib/imageCompress'

export const useCharacterStore = defineStore('character', () => {
  const sheet = ref(null)
  const loading = ref(false)
  const saving = ref(false)

  async function fetchSheet(profileId) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('character_sheets')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error
      sheet.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function upsertSheet(profileId, fields) {
    saving.value = true
    try {
      const { data, error } = await supabase
        .from('character_sheets')
        .upsert(
          { profile_id: profileId, ...fields, updated_at: new Date().toISOString() },
          { onConflict: 'profile_id' }
        )
        .select()
        .single()
      if (error) throw error
      sheet.value = data
      return data
    } finally {
      saving.value = false
    }
  }

  async function uploadCharacterPhoto(profileId, file) {
    const rateLimitMsg = checkRateLimit('upload')
    if (rateLimitMsg) throw new Error(rateLimitMsg)

    const compressed = await compressImage(file)
    const ext = (compressed.name || file.name).split('.').pop()
    const fileName = `${profileId}/photo_${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('character-photos')
      .upload(fileName, compressed, { upsert: true })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('character-photos')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  }

  return { sheet, loading, saving, fetchSheet, upsertSheet, uploadCharacterPhoto }
})
