<template>
  <div v-if="!message.deleted_for_everyone" class="bubble-wrapper" :class="{ mine: isMine, 'first-of-group': firstOfGroup }">
    <UserAvatar
      v-if="isGroup"
      class="bubble-avatar"
      :url="message.sender?.avatar_url"
      :name="message.sender?.display_name || '?'"
      :size="32"
    />
    <!-- Action buttons -->
    <div v-if="!message.deleted_for_everyone && !editMode" class="bubble-actions">
      <button
        class="action-btn-mini"
        @click.stop="togglePicker"
        title="Réagir"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
      </button>
      <button
        class="action-btn-mini reply-btn"
        @click="$emit('reply', message)"
        title="Répondre"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
      </button>
      <button
        v-if="canEdit"
        class="action-btn-mini edit-btn"
        @click.stop="startEdit"
        title="Modifier"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button
        v-if="isMine || auth.isAdmin"
        class="action-btn-mini delete-btn"
        @click="confirmDelete"
        title="Supprimer pour tout le monde"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>

    <div class="bubble-content-wrap">
      <div class="bubble" :class="{ mine: isMine, deleted: message.deleted_for_everyone, mentioned: mentionsMe, editing: editMode }">
        <span v-if="isGroup && !isMine && !message.deleted_for_everyone && firstOfGroup" class="bubble-sender">
          {{ message.sender?.display_name || '?' }}
        </span>

        <div v-if="message.parent_message_id && message.parent && !message.deleted_for_everyone" class="quoted-parent">
          <span class="quoted-author">{{ message.parent.sender?.display_name || '?' }}</span>
          <span class="quoted-content">{{ parentPreview }}</span>
        </div>

        <p v-if="message.deleted_for_everyone" class="bubble-text tombstone">
          🚫 Message supprimé
        </p>

        <template v-else>
          <img
            v-if="message.image_url"
            :src="message.image_url"
            alt="Image"
            class="bubble-image"
            @click="openImage(message.image_url)"
          />

          <!-- Edit mode -->
          <div v-if="editMode" class="edit-area">
            <textarea
              ref="editTextarea"
              v-model="editDraft"
              class="edit-textarea"
              maxlength="2000"
              rows="2"
              @keydown.enter.exact.prevent="saveEdit"
              @keydown.esc.prevent="cancelEdit"
            ></textarea>
            <div class="edit-actions">
              <button class="edit-btn-cancel" @click.stop="cancelEdit" :disabled="editSaving">Annuler</button>
              <button class="edit-btn-save" @click.stop="saveEdit" :disabled="editSaving || !canSaveEdit">
                {{ editSaving ? '...' : 'Enregistrer' }}
              </button>
            </div>
            <span v-if="editError" class="edit-error">{{ editError }}</span>
          </div>

          <p v-else-if="message.content" class="bubble-text">{{ message.content }}</p>
        </template>

        <span class="bubble-time">
          {{ timeAgo(message.created_at) }}
          <span v-if="message.edited_at && !message.deleted_for_everyone" class="bubble-edited" title="Message modifié">· modifié</span>
        </span>
      </div>

      <!-- Reactions -->
      <div v-if="reactions.length > 0 && !message.deleted_for_everyone" class="reactions-row">
        <button
          v-for="r in reactions"
          :key="r.emoji"
          class="reaction-chip"
          :class="{ mine: r.mine }"
          @click.stop="$emit('toggle-reaction', message.id, r.emoji)"
          :title="r.emoji"
        >
          <span class="reaction-emoji">{{ r.emoji }}</span>
          <span class="reaction-count">{{ r.count }}</span>
        </button>
      </div>

      <!-- Info button (regroupe vues + réactions) -->
      <div v-if="showInfoButton" class="info-row">
        <button
          class="info-btn"
          :class="{ read: hasViewsTab && (isGroup ? groupReaders.length > 0 : message.read) }"
          @click.stop="toggleInfo"
          :title="infoButtonTitle"
        >
          <!-- Views icon (double-check if read, single if sent, eye for group) -->
          <span v-if="hasViewsTab" class="info-btn-icon">
            <svg v-if="isGroup" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else-if="message.read" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 7 17 13 11"/><polyline points="10 17 15 17 22 7"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>
          </span>
          <span v-else class="info-btn-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </span>
          <span class="info-btn-label">{{ infoButtonLabel }}</span>
        </button>

        <div v-if="showInfoPanel" class="info-panel" @click.stop>
          <div class="info-tabs">
            <button
              class="info-tab"
              :class="{ active: infoTab === 'views' }"
              @click="infoTab = 'views'"
              :disabled="!hasViewsTab"
            >
              Vues<span v-if="viewsCount > 0" class="info-tab-count">{{ viewsCount }}</span>
            </button>
            <button
              class="info-tab"
              :class="{ active: infoTab === 'reactions' }"
              @click="infoTab = 'reactions'"
              :disabled="!hasReactionsTab"
            >
              Réactions<span v-if="totalReactions > 0" class="info-tab-count">{{ totalReactions }}</span>
            </button>
          </div>

          <!-- Views tab -->
          <div v-if="infoTab === 'views'" class="info-tab-content">
            <template v-if="!isGroup && isMine">
              <div class="info-status-row">
                <span class="info-status-icon" :class="{ read: message.read }">
                  <svg v-if="message.read" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 7 17 13 11"/><polyline points="10 17 15 17 22 7"/></svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>
                </span>
                <span class="info-status-text">{{ message.read ? 'Lu par votre interlocuteur' : 'Envoyé, pas encore lu' }}</span>
              </div>
            </template>
            <template v-else-if="isGroup && isMine">
              <div v-if="groupReaders.length === 0" class="info-empty">Personne ne l'a encore lu.</div>
              <div
                v-for="r in groupReaders"
                :key="r.profile.id"
                class="info-row-line"
              >
                <UserAvatar
                  :url="r.profile.avatar_url"
                  :name="r.profile.display_name || '?'"
                  :size="24"
                />
                <span class="info-row-name">{{ r.profile.display_name || r.profile.username }}</span>
                <span class="info-row-time">{{ timeAgo(r.last_read_at) }}</span>
              </div>
            </template>
            <template v-else>
              <div class="info-empty">Aucune information de lecture.</div>
            </template>
          </div>

          <!-- Reactions tab -->
          <div v-else-if="infoTab === 'reactions'" class="info-tab-content">
            <div v-if="reactions.length === 0" class="info-empty">Aucune réaction.</div>
            <div v-for="r in reactions" :key="r.emoji" class="info-reaction-group">
              <div class="info-reaction-header">
                <span class="info-reaction-emoji">{{ r.emoji }}</span>
                <span class="info-reaction-count">{{ r.count }}</span>
              </div>
              <div
                v-for="p in (r.profiles || [])"
                :key="r.emoji + '-' + p.id"
                class="info-row-line"
              >
                <UserAvatar
                  :url="p.avatar_url"
                  :name="p.display_name || '?'"
                  :size="22"
                />
                <span class="info-row-name">{{ p.display_name || p.username }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Picker popover -->
      <ReactionPicker
        v-if="showPicker && !message.deleted_for_everyone"
        @pick="onPick"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { timeAgo } from '../lib/time'
import ReactionPicker from './ReactionPicker.vue'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  message: { type: Object, required: true },
  isGroup: { type: Boolean, default: false },
  firstOfGroup: { type: Boolean, default: false },
  showReadStatus: { type: Boolean, default: false },
  reactions: { type: Array, default: () => [] },
  // Map<profile_id, { profile, last_read_at }> for the open group conversation
  groupReads: { type: [Map, null], default: null },
})

const emit = defineEmits(['delete', 'reply', 'toggle-reaction'])

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const showPicker = ref(false)

const isMine = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.message.sender_id)
})

const mentionsMe = computed(() => {
  if (props.message.deleted_for_everyone) return false
  const c = props.message.content || ''
  if (!c.includes('@')) return false
  const myUsername = (auth.activeProfile?.username || '').toLowerCase()
  if (!myUsername) return false
  const matches = [...c.matchAll(/(?:^|\s)@([a-zA-Z0-9_]+)/g)].map((m) => m[1].toLowerCase())
  return matches.includes(myUsername)
})

const parentPreview = computed(() => {
  const p = props.message.parent
  if (!p) return ''
  if (p.deleted_for_everyone) return 'Message supprimé'
  const c = p.content || ''
  return c.length > 80 ? c.slice(0, 80) + '...' : (c || '🖼️ Image')
})

const groupReaders = computed(() => {
  if (!props.isGroup || !props.groupReads || !isMine.value) return []
  if (props.message.deleted_for_everyone) return []
  const sentAt = new Date(props.message.created_at).getTime()
  const out = []
  for (const [profileId, entry] of props.groupReads) {
    if (!entry?.last_read_at) continue
    if (profileId === props.message.sender_id) continue
    const readAt = new Date(entry.last_read_at).getTime()
    if (readAt >= sentAt) {
      out.push({ profile: entry.profile, last_read_at: entry.last_read_at })
    }
  }
  return out.sort((a, b) => new Date(b.last_read_at) - new Date(a.last_read_at))
})

// ============ Edit mode ============
const canEdit = computed(() =>
  isMine.value &&
  !props.message.deleted_for_everyone &&
  typeof props.message.content === 'string' &&
  props.message.content.trim().length > 0
)
const editMode = ref(false)
const editDraft = ref('')
const editSaving = ref(false)
const editError = ref('')
const editTextarea = ref(null)
const canSaveEdit = computed(() => {
  const t = (editDraft.value || '').trim()
  return t.length > 0 && t !== (props.message.content || '').trim() && t.length <= 2000
})

function startEdit() {
  editDraft.value = props.message.content || ''
  editError.value = ''
  editMode.value = true
  showPicker.value = false
  showInfoPanel.value = false
  nextTick(() => {
    if (editTextarea.value) {
      editTextarea.value.focus()
      const len = editTextarea.value.value.length
      editTextarea.value.setSelectionRange(len, len)
    }
  })
}

function cancelEdit() {
  editMode.value = false
  editDraft.value = ''
  editError.value = ''
}

async function saveEdit() {
  if (!canSaveEdit.value || editSaving.value) return
  editSaving.value = true
  editError.value = ''
  try {
    await messagesStore.editMessage(props.message.id, editDraft.value)
    editMode.value = false
    editDraft.value = ''
  } catch (e) {
    editError.value = e.message || 'Erreur lors de la modification'
  } finally {
    editSaving.value = false
  }
}

// ============ Info panel ============
const showInfoPanel = ref(false)
const infoTab = ref('views')

const totalReactions = computed(() =>
  (props.reactions || []).reduce((sum, r) => sum + (r.count || 0), 0)
)

const hasReactionsTab = computed(() => totalReactions.value > 0)
const hasViewsTab = computed(() => {
  if (props.message.deleted_for_everyone) return false
  if (!isMine.value) return false
  return true
})

const viewsCount = computed(() => {
  if (!hasViewsTab.value) return 0
  if (props.isGroup) return groupReaders.value.length
  return props.message.read ? 1 : 0
})

const showInfoButton = computed(() => {
  if (props.message.deleted_for_everyone) return false
  if (editMode.value) return false
  return hasReactionsTab.value || hasViewsTab.value
})

const infoButtonLabel = computed(() => {
  const parts = []
  if (hasViewsTab.value) {
    if (props.isGroup) parts.push(`${groupReaders.value.length} vu`)
    else parts.push(props.message.read ? 'Lu' : 'Envoyé')
  }
  if (hasReactionsTab.value) parts.push(`${totalReactions.value} réa.`)
  return parts.join(' · ')
})

const infoButtonTitle = computed(() => 'Détails (vues et réactions)')

function toggleInfo() {
  if (!showInfoPanel.value) {
    if (hasViewsTab.value) infoTab.value = 'views'
    else if (hasReactionsTab.value) infoTab.value = 'reactions'
  }
  showInfoPanel.value = !showInfoPanel.value
}

function openImage(url) {
  window.open(url, '_blank')
}

function togglePicker() {
  showPicker.value = !showPicker.value
}

function onPick(emoji) {
  emit('toggle-reaction', props.message.id, emoji)
  showPicker.value = false
}

function confirmDelete() {
  if (!confirm('Supprimer ce message pour tout le monde ?')) return
  emit('delete', props.message.id)
}

function onClickOutside(e) {
  const target = e.target
  if (showPicker.value) {
    if (!(target.closest && (target.closest('.reaction-picker') || target.closest('.action-btn-mini')))) {
      showPicker.value = false
    }
  }
  if (showInfoPanel.value) {
    if (!(target.closest && (target.closest('.info-panel') || target.closest('.info-btn')))) {
      showInfoPanel.value = false
    }
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped src="./MessageBubble.css"></style>
