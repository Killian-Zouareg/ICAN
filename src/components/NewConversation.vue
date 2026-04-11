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
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { supabase } from '../lib/supabase'

const emit = defineEmits(['created'])
const auth = useAuthStore()
const messagesStore = useMessagesStore()

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
  emit('created', convId)
  close()
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

<style scoped src="./NewConversation.css"></style>
