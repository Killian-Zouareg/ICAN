<template>
  <div class="conversation-list">
    <div v-if="conversations.length === 0" class="empty">
      Aucune conversation
    </div>
    <div
      v-for="conv in conversations"
      :key="conv.id"
      class="conv-item"
      :class="{ unread: conv.hasUnread, active: conv.id === activeId }"
      @click="$emit('select', conv)"
    >
      <UserAvatar :url="conv.otherUser?.avatar_url" :name="conv.otherUser?.display_name || '?'" :size="48" />
      <div class="conv-body">
        <div class="conv-top">
          <span class="conv-name">{{ conv.otherUser?.display_name }}</span>
          <span class="conv-handle">@{{ conv.otherUser?.username }}</span>
          <span class="conv-time">{{ formatTime(conv.lastMessageTime) }}</span>
        </div>
        <div class="conv-bottom">
          <span class="conv-preview">{{ conv.lastMessage || 'Aucun message' }}</span>
        </div>
      </div>
      <div v-if="conv.hasUnread" class="conv-unread-dot"></div>
      <button class="conv-hide" @click.stop="$emit('hide', conv.id)" title="Masquer">&times;</button>
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

<style scoped>
.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
  border-bottom: 1px solid var(--border);
}

.conv-item:hover {
  background: var(--bg-hover);
}

.conv-item.active {
  background: var(--bg-hover);
  border-right: 2px solid var(--accent);
}

.conv-item.unread {
  background: rgba(29, 161, 242, 0.04);
}

.conv-item.unread:hover {
  background: rgba(29, 161, 242, 0.08);
}

.conv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.conv-top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.conv-name {
  font-weight: 700;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.conv-item.unread .conv-name {
  color: var(--text-primary);
}

.conv-handle {
  color: var(--text-secondary);
  font-size: 0.82rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-time {
  color: var(--text-secondary);
  font-size: 0.78rem;
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.conv-preview {
  font-size: 0.84rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-item.unread .conv-preview {
  color: var(--text-primary);
  font-weight: 500;
}

.conv-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.conv-hide {
  display: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 50%;
  line-height: 1;
  flex-shrink: 0;
}

.conv-item:hover .conv-hide {
  display: block;
}

.conv-hide:hover {
  color: var(--danger);
  background: rgba(224, 36, 94, 0.1);
}

.empty {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
