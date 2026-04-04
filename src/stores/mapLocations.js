import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useMapLocationsStore = defineStore('mapLocations', () => {
  const locations = ref([])
  const loading = ref(false)
  const selectedLocation = ref(null)
  const filterCategory = ref(null)

  const CATEGORIES = {
    residence: { label: 'Residence', color: '#1da1f2', emoji: '\u{1F3E0}' },
    school:    { label: 'Ecole',     color: '#17bf63', emoji: '\u{1F3EB}' },
    landmark:  { label: 'Lieu cl\u00e9', color: '#FFD700', emoji: '\u2B50' },
    hq:        { label: 'QG',        color: '#9b59b6', emoji: '\u{1F3E2}' },
    danger:    { label: 'Danger',    color: '#e0245e', emoji: '\u26A0\uFE0F' },
    shop:      { label: 'Commerce',  color: '#f39c12', emoji: '\u{1F6D2}' },
    hospital:  { label: 'H\u00f4pital',  color: '#00d2d3', emoji: '\u{1F3E5}' },
    police:    { label: 'Police',    color: '#3d5af1', emoji: '\u{1F694}' },
    villain:   { label: 'Vilain',    color: '#8b0000', emoji: '\u{1F480}' },
    other:     { label: 'Autre',     color: '#8899a6', emoji: '\u{1F4CD}' },
  }

  const filteredLocations = computed(() => {
    if (!filterCategory.value) return locations.value
    return locations.value.filter((l) => l.category === filterCategory.value)
  })

  async function fetchLocations() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('map_locations')
        .select('*, linked_profile:profiles!map_locations_linked_profile_id_fkey(id, username, display_name, avatar_url)')
        .order('name')

      if (error) {
        console.error('fetchLocations error:', error.message)
        return
      }
      locations.value = data || []
    } finally {
      loading.value = false
    }
  }

  async function createLocation({ name, description, category, lat, lng, imageFile, linkedProfileId }) {
    let image_url = null
    if (imageFile) {
      image_url = await uploadLocationImage(imageFile)
    }

    const { data, error } = await supabase
      .from('map_locations')
      .insert({
        name,
        description: description || '',
        category: category || 'other',
        lat,
        lng,
        image_url,
        linked_profile_id: linkedProfileId || null,
      })
      .select('*, linked_profile:profiles!map_locations_linked_profile_id_fkey(id, username, display_name, avatar_url)')
      .single()

    if (error) throw error
    locations.value.push(data)
    return data
  }

  async function updateLocation(id, { name, description, category, lat, lng, imageFile, linkedProfileId, removeImage }) {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (category !== undefined) updates.category = category
    if (lat !== undefined) updates.lat = lat
    if (lng !== undefined) updates.lng = lng
    if (linkedProfileId !== undefined) updates.linked_profile_id = linkedProfileId || null
    if (removeImage) updates.image_url = null

    if (imageFile) {
      updates.image_url = await uploadLocationImage(imageFile)
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('map_locations')
      .update(updates)
      .eq('id', id)
      .select('*, linked_profile:profiles!map_locations_linked_profile_id_fkey(id, username, display_name, avatar_url)')
      .single()

    if (error) throw error

    const idx = locations.value.findIndex((l) => l.id === id)
    if (idx !== -1) locations.value[idx] = data
    if (selectedLocation.value?.id === id) selectedLocation.value = data
    return data
  }

  async function deleteLocation(id) {
    const { error } = await supabase.from('map_locations').delete().eq('id', id)
    if (error) throw error
    locations.value = locations.value.filter((l) => l.id !== id)
    if (selectedLocation.value?.id === id) selectedLocation.value = null
  }

  async function uploadLocationImage(file) {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('map-images')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('map-images').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }

  function selectLocation(location) {
    selectedLocation.value = location
  }

  function clearSelection() {
    selectedLocation.value = null
  }

  return {
    locations,
    loading,
    selectedLocation,
    filterCategory,
    filteredLocations,
    CATEGORIES,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    selectLocation,
    clearSelection,
  }
})
