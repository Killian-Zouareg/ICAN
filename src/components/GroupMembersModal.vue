<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ conversation.group_name || 'Groupe' }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-section">
        <div class="section-title">
          {{ members.length }} membre(s)
          <span v-if="creatorProfile" class="creator-badge">Créateur : {{ creatorProfile.display_name }}</span>
        </div>
        <div v-if="loadingMembers" class="loading">Chargement...</div>
        <div v-else class="member-list">
          <div v-for="m in members" :key="m.id" class="member-row">
            <UserAvatar :url="m.avatar_url" :name="m.display_name || '?'" :size="36" />
            <div class="member-info">
              <span class="member-name">
                {{ m.display_name }}
                <span v-if="m.id === conversation.creator_id" class="creator-tag">★</span>
              </span>
              <span class="member-handle">@{{ m.username }}</span>
            </div>
            <button
              v-if="canRemoveMember(m)"
              class="remove-btn"
              :disabled="removingId === m.id"
              @click="removeMember(m.id)"
              title="Retirer du groupe"
            >&times;</button>
          </div>
        </div>
      </div>

      <!-- Add members (creator only) -->
      <div v-if="isCreator" class="modal-section">
        <div class="section-title">Ajouter des membres</div>
        <input
          v-model="addQuery"
          type="text"
          placeholder="Rechercher un utilisateur..."
          @input="searchUsers"
          class="add-input"
        />
        <div v-if="addSearching" class="loading">Recherche...</div>
        <div v-else-if="addQuery && addResults.length === 0" class="no-results">Aucun résultat</div>
        <div class="add-results">
          <div
            v-for="u in addResults"
            :key="u.id"
            class="member-row"
            @click="addMember(u)"
          >
            <UserAvatar :url="u.avatar_url" :name="u.display_name || '?'" :size="32" />
            <div class="member-info">
              <span class="member-name">{{ u.display_name }}</span>
              <span class="member-handle">@{{ u.username }}</span>
            </div>
            <span class="add-icon">+</span>
          </div>
        </div>
      </div>

      <!-- Delete group (creator only) -->
      <div v-if="isCreator" class="modal-section danger-section">
        <button class="danger-btn" :disabled="deleting" @click="confirmDelete">
          {{ deleting ? 'Suppression...' : 'Supprimer le groupe' }}
        </button>
      </div>

      <!-- Leave group (non-creator) -->
      <div v-else class="modal-section danger-section">
        <button class="danger-btn" :disabled="leaving" @click="leaveGroup">
          {{ leaving ? 'Sortie...' : 'Quitter le groupe' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  conversation: { type: Object, required: true },
})

const emit = defineEmits(['close', 'updated', 'deleted'])

const auth = useAuthStore()
const messagesStore = useMessagesStore()

const members = ref([])
const loadingMembers = ref(false)
const addQuery = ref('')
const addResults = ref([])
const addSearching = ref(false)
const removingId = ref(null)
const deleting = ref(false)
const leaving = ref(false)

let searchTimeout = null

const isCreator = computed(() => {
  const myIds = auth.profiles.map((p) => p.id)
  return myIds.includes(props.conversation.creator_id)
})

const creatorProfile = computed(() => {
  return members.value.find((m) => m.id === props.conversation.creator_id) || null
})

function canRemoveMember(member) {
  // Creator can remove anyone except themselves; users can remove themselves
  if (member.id === props.conversation.creator_id) return false
  if (isCreator.value) return true
  const myIds = auth.profiles.map((p) => p.id)
  return myIds.includes(member.id)
}

async function loadMembers() {
  loadingMembers.value = true
  try {
    members.value = await messagesStore.fetchGroupMembers(props.conversation.id)
  } catch (e) {
    alert('Erreur chargement membres : ' + (e.message || ''))
  } finally {
    loadingMembers.value = false
  }
}

function searchUsers() {
  clearTimeout(searchTimeout)
  if (!addQuery.value.trim()) {
    addResults.value = []
    return
  }
  addSearching.value = true
  searchTimeout = setTimeout(async () => {
    const term = `%${addQuery.value.trim()}%`
    const memberIds = new Set(members.value.map((m) => m.id))
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(10)
    addResults.value = (data || []).filter((u) => !memberIds.has(u.id))
    addSearching.value = false
  }, 300)
}

async function addMember(user) {
  try {
    await messagesStore.addGroupMembers(props.conversation.id, [user.id])
    addQuery.value = ''
    addResults.value = []
    await loadMembers()
    emit('updated')
  } catch (e) {
    alert('Erreur ajout : ' + (e.message || ''))
  }
}

async function removeMember(memberId) {
  removingId.value = memberId
  try {
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', props.conversation.id)
      .eq('profile_id', memberId)
    if (error) throw error
    await loadMembers()
    emit('updated')
  } catch (e) {
    alert('Erreur retrait : ' + (e.message || ''))
  } finally {
    removingId.value = null
  }
}

async function confirmDelete() {
  if (!confirm(`Supprimer définitivement le groupe "${props.conversation.group_name}" ? Cette action est irréversible et supprime tous les messages.`)) {
    return
  }
  deleting.value = true
  try {
    await messagesStore.deleteGroupConversation(props.conversation.id)
    emit('deleted')
  } catch (e) {
    alert('Erreur suppression : ' + (e.message || ''))
    deleting.value = false
  }
}

async function leaveGroup() {
  if (!confirm('Quitter ce groupe ?')) return
  leaving.value = true
  try {
    const myProfileId = auth.activeProfile.id
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', props.conversation.id)
      .eq('profile_id', myProfileId)
    if (error) throw error
    emit('deleted')
  } catch (e) {
    alert('Erreur : ' + (e.message || ''))
    leaving.value = false
  }
}

onMounted(() => loadMembers())
</script>

<style scoped src="./GroupMembersModal.css"></style>
