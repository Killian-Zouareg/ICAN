<template>
  <div class="new-conv">
    <button v-if="!showSearch" class="new-btn" @click="showSearch = true">
      + Nouveau message
    </button>

    <div v-else class="search-box">
      <div class="search-header">
        <input
          v-model="query"
          type="text"
          placeholder="Rechercher un utilisateur..."
          @input="search"
          ref="searchInput"
        />
        <button class="cancel-btn" @click="close">Annuler</button>
      </div>

      <div v-if="searching" class="search-status">Recherche...</div>
      <div v-else-if="query && results.length === 0" class="search-status">Aucun résultat</div>
      <div v-for="user in results" :key="user.id" class="user-result" @click="startConversation(user)">
        <div class="result-avatar">{{ user.display_name.charAt(0).toUpperCase() }}</div>
        <div class="result-info">
          <span class="result-name">{{ user.display_name }}</span>
          <span class="result-handle">@{{ user.username }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const router = useRouter()

const showSearch = ref(false)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchInput = ref(null)

let searchTimeout = null

function search() {
  clearTimeout(searchTimeout)
  if (!query.value.trim()) {
    results.value = []
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    const term = `%${query.value.trim()}%`
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .neq('id', auth.user.id)
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(10)
    results.value = data || []
    searching.value = false
  }, 300)
}

async function startConversation(user) {
  const convId = await messagesStore.getOrCreateConversation(user.id)
  router.push(`/messages/${convId}`)
}

function close() {
  showSearch.value = false
  query.value = ''
  results.value = []
}

nextTick(() => {
  if (searchInput.value) searchInput.value.focus()
})
</script>

<style scoped>
.new-conv {
  border-bottom: 1px solid var(--border);
}

.new-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.95rem;
  cursor: pointer;
  text-align: left;
}

.new-btn:hover {
  background: var(--bg-hover);
}

.search-box {
  padding: 0.75rem 1rem;
}

.search-header {
  display: flex;
  gap: 0.5rem;
}

.search-header input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.search-header input:focus {
  outline: none;
  border-color: var(--accent);
}

.cancel-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.cancel-btn:hover {
  color: var(--text-primary);
}

.search-status {
  padding: 0.75rem 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.user-result {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  cursor: pointer;
  border-radius: 8px;
}

.user-result:hover {
  background: var(--bg-hover);
}

.result-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.result-info {
  display: flex;
  flex-direction: column;
}

.result-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.result-handle {
  color: var(--text-secondary);
  font-size: 0.8rem;
}
</style>
