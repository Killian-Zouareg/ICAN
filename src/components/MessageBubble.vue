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
    <div v-if="!message.deleted_for_everyone" class="bubble-actions">
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
        v-if="isMine || auth.isAdmin"
        class="action-btn-mini delete-btn"
        @click="confirmDelete"
        title="Supprimer pour tout le monde"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>

    <div class="bubble-content-wrap">
      <div class="bubble" :class="{ mine: isMine, deleted: message.deleted_for_everyone, mentioned: mentionsMe }">
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
          <p v-if="message.content" class="bubble-text">{{ message.content }}</p>
        </template>

        <span class="bubble-time">{{ timeAgo(message.created_at) }}</span>
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

      <!-- Read receipt -->
      <div
        v-if="showReadStatus && isMine && !message.deleted_for_everyone"
        class="read-receipt"
        :class="{ read: message.read }"
      >
        <span v-if="message.read" class="receipt-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 7 17 13 11"/><polyline points="10 17 15 17 22 7"/></svg>
          Lu
        </span>
        <span v-else class="receipt-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>
          Envoyé
        </span>
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'
import ReactionPicker from './ReactionPicker.vue'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  message: { type: Object, required: true },
  isGroup: { type: Boolean, default: false },
  firstOfGroup: { type: Boolean, default: false },
  showReadStatus: { type: Boolean, default: false },
  reactions: { type: Array, default: () => [] },
})

const emit = defineEmits(['delete', 'reply', 'toggle-reaction'])

const auth = useAuthStore()
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
  if (!showPicker.value) return
  // Close if click is outside any reaction-picker / action button
  const target = e.target
  if (target.closest && (target.closest('.reaction-picker') || target.closest('.action-btn-mini'))) return
  showPicker.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped src="./MessageBubble.css"></style>
