import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const COLORS = ['#fef3a7', '#ffd6e0', '#c8f7c5', '#cfe7ff', '#f3d9ff', '#ffe2b8', '#d9f0ff', '#ffd1d1']

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export const useAnonymousStore = defineStore('anonymous', () => {
  const posts = ref([])
  const loading = ref(false)
  const sending = ref(false)

  async function fetchPosts() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('anonymous_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      posts.value = data || []
    } catch (e) {
      console.error('[anonymous] fetchPosts', e)
      posts.value = []
    } finally {
      loading.value = false
    }
  }

  async function createPost(content) {
    const trimmed = (content || '').trim()
    if (!trimmed) return { error: 'Le post est vide.' }
    if (trimmed.length > 280) return { error: 'Maximum 280 caractères.' }

    sending.value = true
    try {
      const { data, error } = await supabase
        .from('anonymous_posts')
        .insert({ content: trimmed, color: pickColor() })
        .select()
        .single()
      if (error) throw error
      if (data) posts.value.unshift(data)
      return { data }
    } catch (e) {
      console.error('[anonymous] createPost', e)
      return { error: e.message || 'Erreur lors de la publication.' }
    } finally {
      sending.value = false
    }
  }

  return { posts, loading, sending, fetchPosts, createPost }
})
