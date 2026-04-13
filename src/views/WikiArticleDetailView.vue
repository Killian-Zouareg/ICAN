<template>
  <div class="wiki-article-detail">
    <div v-if="loading" class="loading">Chargement...</div>
    <div v-else-if="!article" class="not-found">Article introuvable</div>
    <template v-else>
      <!-- Header -->
      <div class="article-header" :style="article.image_url ? { backgroundImage: `url(${article.image_url})` } : {}">
        <div class="header-overlay">
          <button @click="$router.push('/wiki/articles')" class="back-btn">&larr; Encyclop&eacute;die</button>
          <span class="header-cat-badge" :class="article.category">{{ getCatEmoji(article.category) }} {{ getCatLabel(article.category) }}</span>
          <h1 class="header-title">{{ article.title }}</h1>
          <p v-if="article.summary" class="header-summary">{{ article.summary }}</p>
          <div v-if="article.tags?.length" class="header-tags">
            <span v-for="t in article.tags" :key="t" class="tag-pill">{{ t }}</span>
          </div>
        </div>
      </div>

      <!-- Admin controls -->
      <div v-if="auth.isAdmin" class="admin-controls">
        <button v-if="!editing" class="ctrl-btn edit" @click="startEdit">&#9998; Modifier</button>
        <button v-if="!editing" class="ctrl-btn delete" @click="confirmDelete">&#128465; Supprimer</button>
        <template v-if="editing">
          <button class="ctrl-btn save" :disabled="saving" @click="saveArticle">{{ saving ? 'Sauvegarde...' : '&#10003; Sauvegarder' }}</button>
          <button class="ctrl-btn cancel" @click="cancelEdit">Annuler</button>
        </template>
      </div>

      <!-- View mode -->
      <div v-if="!editing" class="article-body">
        <div v-if="article.content" class="article-content wiki-rendered" v-html="renderedContent"></div>
        <p v-else class="empty-content">Aucun contenu pour cet article.</p>

        <div v-if="relatedArticles.length" class="related-section">
          <h3>Articles li&eacute;s</h3>
          <div class="related-list">
            <div
              v-for="ra in relatedArticles"
              :key="ra.id"
              class="related-card"
              @click="$router.push(`/wiki/article/${ra.slug}`)"
            >
              <span class="related-emoji">{{ getCatEmoji(ra.category) }}</span>
              <span class="related-title">{{ ra.title }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="article-edit">
        <div class="edit-field">
          <label>Titre</label>
          <input v-model="editForm.title" type="text" />
        </div>
        <div class="edit-field">
          <label>Cat&eacute;gorie</label>
          <select v-model="editForm.category">
            <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.emoji }} {{ c.label }}</option>
          </select>
        </div>
        <div class="edit-field">
          <label>R&eacute;sum&eacute;</label>
          <textarea v-model="editForm.summary" rows="2"></textarea>
        </div>
        <div class="edit-field">
          <label>Contenu <span class="hint">Utilisez [[Nom]] pour cr&eacute;er des liens vers d'autres articles</span></label>
          <textarea v-model="editForm.content" rows="14"></textarea>
        </div>
        <div class="edit-field">
          <label>Tags</label>
          <div class="tags-editor">
            <span v-for="(t, i) in editForm.tags" :key="i" class="tag-pill editable" @click="editForm.tags.splice(i, 1)">{{ t }} &times;</span>
            <input
              v-model="newTag"
              type="text"
              placeholder="Ajouter un tag..."
              @keydown.enter.prevent="addTag"
            />
          </div>
        </div>
        <div class="edit-field">
          <label>Image</label>
          <input type="file" accept="image/*" @change="uploadImg" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useWikiArticlesStore, CATEGORIES } from '../stores/wikiArticles'
import { renderWikiContent } from '../lib/wikiLinks'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useWikiArticlesStore()

const categories = CATEGORIES
const editing = ref(false)
const editForm = ref({})
const newTag = ref('')

const article = computed(() => store.currentArticle)
const loading = computed(() => store.loading)
const saving = computed(() => store.saving)

const renderedContent = computed(() => {
  if (!article.value?.content) return ''
  return renderWikiContent(article.value.content, store.articles)
})

const relatedArticles = computed(() => {
  if (!article.value?.related_articles?.length) return []
  return store.articles.filter(a => article.value.related_articles.includes(a.id))
})

function getCatEmoji(cat) {
  return CATEGORIES.find(c => c.value === cat)?.emoji || '📖'
}
function getCatLabel(cat) {
  return CATEGORIES.find(c => c.value === cat)?.label || cat
}

function startEdit() {
  editForm.value = {
    title: article.value.title || '',
    category: article.value.category || 'general',
    summary: article.value.summary || '',
    content: article.value.content || '',
    tags: [...(article.value.tags || [])],
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function addTag() {
  const t = newTag.value.trim()
  if (t && !editForm.value.tags.includes(t)) {
    editForm.value.tags.push(t)
  }
  newTag.value = ''
}

async function saveArticle() {
  try {
    await store.update(article.value.id, editForm.value)
    editing.value = false
    if (editForm.value.title !== article.value.title) {
      // slug may have changed, re-fetch
      await store.fetchBySlug(store.currentArticle.slug)
    }
  } catch (err) {
    alert(err.message)
  }
}

async function uploadImg(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    await store.uploadImage(article.value.id, file)
  } catch (err) {
    alert(err.message)
  }
}

async function confirmDelete() {
  if (!confirm('Supprimer cet article ?')) return
  try {
    await store.remove(article.value.id)
    router.push('/wiki/articles')
  } catch (err) {
    alert(err.message)
  }
}

async function loadArticle(slug) {
  await store.fetchBySlug(slug)
  if (store.articles.length === 0) await store.fetchAll()
}

watch(() => route.params.slug, (slug) => {
  if (slug) loadArticle(slug)
})

onMounted(() => {
  if (route.params.slug) loadArticle(route.params.slug)
})
</script>

<style scoped src="./WikiArticleDetailView.css"></style>
