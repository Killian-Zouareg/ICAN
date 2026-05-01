<template>
  <div class="new-conv">
    <div v-if="!showSearch && !showGroup" class="new-conv-buttons">
      <button class="new-btn" @click="showSearch = true">
        + Nouveau message
      </button>
      <button class="new-btn group-btn" @click="startGroup">
        &#x1F465; Nouveau groupe
      </button>
    </div>

    <!-- 1-on-1 search -->
    <div v-if="showSearch" class="search-box">
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
        <div class="result-avatar">{{ (user.display_name || '?').charAt(0).toUpperCase() }}</div>
        <div class="result-info">
          <span class="result-name">{{ user.display_name }}</span>
          <span class="result-handle">@{{ user.username }}</span>
        </div>
      </div>
    </div>

    <!-- Create group -->
    <div v-if="showGroup" class="search-box group-box">
      <div class="search-header">
        <input
          v-model="groupName"
          type="text"
          placeholder="Nom du groupe..."
          maxlength="50"
          ref="groupNameInput"
        />
        <button class="cancel-btn" @click="close">Annuler</button>
      </div>

      <div v-if="selectedMembers.length > 0" class="selected-members">
        <span class="selected-label">{{ selectedMembers.length }} membre(s) :</span>
        <span
          v-for="m in selectedMembers"
          :key="m.id"
          class="member-chip"
        >
          {{ m.display_name }}
          <button class="chip-remove" @click="removeMember(m.id)">&times;</button>
        </span>
      </div>

      <div class="search-header">
        <input
          v-model="groupQuery"
          type="text"
          placeholder="Ajouter des membres..."
          @input="searchGroupMembers"
        />
      </div>

      <div v-if="groupSearching" class="search-status">Recherche...</div>
      <div v-else-if="groupQuery && groupResults.length === 0" class="search-status">Aucun résultat</div>
      <div
        v-for="user in groupResults"
        :key="user.id"
        class="user-result"
        @click="addMember(user)"
      >
        <div class="result-avatar">{{ (user.display_name || '?').charAt(0).toUpperCase() }}</div>
        <div class="result-info">
          <span class="result-name">{{ user.display_name }}</span>
          <span class="result-handle">@{{ user.username }}</span>
        </div>
      </div>

      <button
        class="create-group-btn"
        :disabled="selectedMembers.length < 2 || !groupName.trim() || creating"
        @click="createGroup"
      >
        {{ creating ? 'Création...' : `Créer le groupe (${selectedMembers.length} membres)` }}
      </button>
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
const showGroup = ref(false)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchInput = ref(null)

const groupNameInput = ref(null)
const groupName = ref('')
const groupQuery = ref('')
const groupResults = ref([])
const groupSearching = ref(false)
const selectedMembers = ref([])
const creating = ref(false)

let searchTimeout = null
let groupSearchTimeout = null

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

function searchGroupMembers() {
  clearTimeout(groupSearchTimeout)
  if (!groupQuery.value.trim()) {
    groupResults.value = []
    return
  }
  groupSearching.value = true
  groupSearchTimeout = setTimeout(async () => {
    const term = `%${groupQuery.value.trim()}%`
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', auth.user.id)
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(10)
    const selectedIds = new Set(selectedMembers.value.map((m) => m.id))
    groupResults.value = (data || []).filter((u) => !selectedIds.has(u.id))
    groupSearching.value = false
  }, 300)
}

function startGroup() {
  showGroup.value = true
  showSearch.value = false
  selectedMembers.value = []
  groupName.value = ''
  groupQuery.value = ''
  groupResults.value = []
  nextTick(() => {
    if (groupNameInput.value) groupNameInput.value.focus()
  })
}

function addMember(user) {
  if (selectedMembers.value.find((m) => m.id === user.id)) return
  selectedMembers.value.push(user)
  groupQuery.value = ''
  groupResults.value = []
}

function removeMember(id) {
  selectedMembers.value = selectedMembers.value.filter((m) => m.id !== id)
}

async function createGroup() {
  if (selectedMembers.value.length < 2) return
  if (!groupName.value.trim()) return
  creating.value = true
  try {
    const memberIds = selectedMembers.value.map((m) => m.id)
    const convId = await messagesStore.createGroupConversation(groupName.value, memberIds)
    emit('created', convId)
    close()
  } catch (e) {
    alert('Erreur création du groupe : ' + (e.message || 'inconnue'))
  } finally {
    creating.value = false
  }
}

async function startConversation(user) {
  const convId = await messagesStore.getOrCreateConversation(user.id)
  emit('created', convId)
  close()
}

function close() {
  showSearch.value = false
  showGroup.value = false
  query.value = ''
  results.value = []
  groupName.value = ''
  groupQuery.value = ''
  groupResults.value = []
  selectedMembers.value = []
}

nextTick(() => {
  if (searchInput.value) searchInput.value.focus()
})
</script>

<style scoped src="./NewConversation.css"></style>
