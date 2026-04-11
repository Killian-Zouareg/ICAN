<template>
  <div class="conversation-list">
    <div v-if="conversations.length === 0" class="empty">
      <div class="empty-icon">&#x2709;</div>
      <p>Aucune conversation</p>
      <span>Commencez une nouvelle discussion !</span>
    </div>
    <div
      v-for="conv in conversations"
      :key="conv.id"
      class="conv-item"
      :class="{ unread: conv.hasUnread, active: conv.id === activeId }"
      @click="$emit('select', conv)"
    >
      <div class="conv-avatar-wrap">
        <UserAvatar :url="conv.otherUser?.avatar_url" :name="conv.otherUser?.display_name || '?'" :size="48" />
        <div v-if="conv.hasUnread" class="conv-online-dot"></div>
      </div>
      <div class="conv-body">
        <div class="conv-top">
          <span class="conv-name">{{ conv.otherUser?.display_name }}</span>
          <span class="conv-handle">@{{ conv.otherUser?.username }}</span>
          <span class="conv-dot">&middot;</span>
          <span class="conv-time">{{ formatTime(conv.lastMessageTime) }}</span>
        </div>
        <div class="conv-bottom">
          <span class="conv-preview">{{ conv.lastMessage || 'Aucun message' }}</span>
        </div>
      </div>
      <button class="conv-hide" @click.stop="$emit('hide', conv.id)" title="Masquer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import UserAvatar from './UserAvatar.vue'

defineProps({
  conversations: { type: Array, required: true },
  activeId: { type: String, default: null },
})

defineEmits(['select', 'hide'])

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'maintenant'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<style scoped src="./ConversationList.css"></style>
