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

<style scoped>
.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-list::-webkit-scrollbar {
  width: 4px;
}

.conversation-list::-webkit-scrollbar-track {
  background: transparent;
}

.conversation-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.25rem;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
  border-bottom: 1px solid transparent;
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

.conv-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.conv-online-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-primary);
}

.conv-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.conv-top {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.conv-name {
  font-weight: 700;
  font-size: 0.93rem;
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
  font-size: 0.83rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-dot {
  color: var(--text-secondary);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.conv-time {
  color: var(--text-secondary);
  font-size: 0.8rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  align-items: center;
}

.conv-preview {
  font-size: 0.87rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.conv-item.unread .conv-preview {
  color: var(--text-primary);
  font-weight: 500;
}

.conv-hide {
  display: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 9999px;
  line-height: 0;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.conv-item:hover .conv-hide {
  display: flex;
  align-items: center;
  justify-content: center;
}

.conv-hide:hover {
  color: var(--danger);
  background: rgba(224, 36, 94, 0.1);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 4rem 1.5rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.25;
  margin-bottom: 0.5rem;
}

.empty p {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty span {
  font-size: 0.85rem;
}
</style>
