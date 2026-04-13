<template>
  <div class="wiki-articles-page">
    <div class="articles-top-bar">
      <button @click="$router.push('/wiki')" class="back-btn">&larr; iWiki</button>
      <h1 class="top-bar-title">Encyclop&eacute;die</h1>
    </div>

    <!-- Category tabs -->
    <div class="category-tabs">
      <button
        v-for="cat in allCategories"
        :key="cat.value"
        class="cat-tab"
        :class="{ active: activeCategory === cat.value }"
        @click="activeCategory = cat.value"
      >
        {{ cat.emoji }} {{ cat.label }}
      </button>
    </div>

    <!-- Search -->
    <input v-model="search" type="text" class="articles-search" placeholder="Rechercher un article..." />

    <!-- Admin create -->
    <button v-if="auth.isAdmin" class="create-btn" @click="showCreate = true">+ Nouvel article</button>

    <div v-if="loading" class="loading">Chargement...</div>

    <!-- Articles list -->
    <div v-else class="articles-list">
      <div
        v-for="article in filtered"
        :key="article.id"
        class="article-card"
        @click="$router.push(`/wiki/article/${article.slug}`)"
      >
        <div class="article-img" :style="article.image_url ? { backgroundImage: `url(${article.image_url})` } : {}">
          <span v-if="!article.image_url" class="article-img-placeholder">{{ getCatEmoji(article.category) }}</span>
        </div>
        <div class="article-info">
          <span class="article-cat-badge" :class="article.category">{{ getCatLabel(article.category) }}</span>
          <span class="article-title">{{ article.title }}</span>
          <span v-if="article.summary" class="article-summary">{{ article.summary }}</span>
          <div v-if="article.tags?.length" class="article-tags">
            <span v-for="t in article.tags.slice(0, 3)" :key="t" class="mini-tag">{{ t }}</span>
          </div>
        </div>
        <span class="article-arrow">&rsaquo;</span>
      </div>
      <p v-if="filtered.length === 0" class="empty">Aucun article trouv&eacute;</p>
    </div>

    <!-- Create modal -->
    <Teleport to="body">
      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal-content">
          <h3>Nouvel article</h3>
          <div class="modal-field">
            <label>Titre</label>
            <input v-model="newArticle.title" type="text" placeholder="Titre de l'article" />
          </div>
          <div class="modal-field">
            <label>Cat&eacute;gorie</label>
            <select v-model="newArticle.category">
              <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.emoji }} {{ c.label }}</option>
            </select>
          </div>
          <div class="modal-field">
            <label>R&eacute;sum&eacute;</label>
            <textarea v-model="newArticle.summary" rows="2" placeholder="Courte description..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showCreate = false">Annuler</button>
            <button class="btn-create" :disabled="!newArticle.title.trim() || saving" @click="createArticle">
              {{ saving ? 'Cr\u00e9ation...' : 'Cr\u00e9er' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useWikiArticlesStore, CATEGORIES } from '../stores/wikiArticles'

const router = useRouter()
const auth = useAuthStore()
const store = useWikiArticlesStore()

const categories = CATEGORIES
const allCategories = [{ value: 'all', label: 'Tous', emoji: '\uD83D\uDCDA' }, ...CATEGORIES]

const activeCategory = ref('all')
const search = ref('')
const showCreate = ref(false)
const loading = computed(() => store.loading)
const saving = computed(() => store.saving)

const newArticle = ref({ title: '', category: 'general', summary: '' })

const filtered = computed(() => {
  let list = store.articles
  if (activeCategory.value !== 'all') {
    list = list.filter(a => a.category === activeCategory.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.summary && a.summary.toLowerCase().includes(q)) ||
      (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
    )
  }
  return list
})

function getCatEmoji(cat) {
  return CATEGORIES.find(c => c.value === cat)?.emoji || '\uD83D\uDCD6'
}
function getCatLabel(cat) {
  return CATEGORIES.find(c => c.value === cat)?.label || cat
}

async function createArticle() {
  try {
    const article = await store.create({
      ...newArticle.value,
      created_by: auth.activeProfile?.id,
    })
    showCreate.value = false
    newArticle.value = { title: '', category: 'general', summary: '' }
    router.push(`/wiki/article/${article.slug}`)
  } catch (err) {
    alert(err.message)
  }
}

onMounted(() => store.fetchAll())
</script>

<style scoped src="./WikiArticlesView.css"></style>
