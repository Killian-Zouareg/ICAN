import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { checkRateLimit } from '../lib/rateLimit'
import { compressImage } from '../lib/imageCompress'

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export const CATEGORIES = [
  { value: 'lieu', label: 'Lieu', emoji: '\uD83D\uDDFA\uFE0F' },
  { value: 'pnj', label: 'PNJ', emoji: '\uD83E\uDDD9' },
  { value: 'objet', label: 'Objet', emoji: '\uD83D\uDCE6' },
  { value: 'evenement', label: '\u00C9v\u00E9nement', emoji: '\u26A1' },
  { value: 'faction', label: 'Faction', emoji: '\uD83C\uDFF4' },
  { value: 'general', label: 'G\u00E9n\u00E9ral', emoji: '\uD83D\uDCD6' },
]

export const useWikiArticlesStore = defineStore('wikiArticles', () => {
  const articles = ref([])
  const currentArticle = ref(null)
  const loading = ref(false)
  const saving = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_articles')
        .select('*')
        .order('title', { ascending: true })
      if (error) throw error
      articles.value = data || []
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchBySlug(slug) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('wiki_articles')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      currentArticle.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function create(fields) {
    saving.value = true
    try {
      const slug = slugify(fields.title)
      const { data, error } = await supabase
        .from('wiki_articles')
        .insert({ ...fields, slug })
        .select()
        .single()
      if (error) throw error
      articles.value.push(data)
      return data
    } finally {
      saving.value = false
    }
  }

  async function update(id, fields) {
    saving.value = true
    try {
      const updates = { ...fields, updated_at: new Date().toISOString() }
      if (fields.title) updates.slug = slugify(fields.title)
      const { data, error } = await supabase
        .from('wiki_articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const idx = articles.value.findIndex(a => a.id === id)
      if (idx !== -1) articles.value[idx] = data
      if (currentArticle.value?.id === id) currentArticle.value = data
      return data
    } finally {
      saving.value = false
    }
  }

  async function remove(id) {
    const { error } = await supabase.from('wiki_articles').delete().eq('id', id)
    if (error) throw error
    articles.value = articles.value.filter(a => a.id !== id)
    if (currentArticle.value?.id === id) currentArticle.value = null
  }

  async function uploadImage(id, file) {
    const msg = checkRateLimit('upload')
    if (msg) throw new Error(msg)
    const compressed = await compressImage(file)
    const ext = (compressed.name || file.name).split('.').pop()
    const path = `wiki-articles/${id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
    if (upErr) throw upErr
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await update(id, { image_url: publicUrl })
    return publicUrl
  }

  return {
    articles, currentArticle, loading, saving,
    fetchAll, fetchBySlug, create, update, remove, uploadImage,
  }
})
