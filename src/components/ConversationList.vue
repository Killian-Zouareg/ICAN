<template>
  <div class="conversation-list">
    <div v-if="conversations.length === 0" class="empty">
      Aucune conversation
    </div>
    <div
      v-for="conv in conversations"
      :key="conv.id"
      class="conversation-item-wrapper"
    >
      <router-link
        :to="`/messages/${conv.id}`"
        class="conversation-item"
      >
        <UserAvatar :url="conv.otherUser.avatar_url" :name="conv.otherUser.display_name" :size="40" />
        <div class="conv-info">
          <span class="conv-name">{{ conv.otherUser.display_name }}</span>
          <span class="conv-handle">@{{ conv.otherUser.username }}</span>
        </div>
      </router-link>
      <button class="hide-btn" @click="$emit('hide', conv.id)" title="Masquer">
        &times;
      </button>
    </div>
  </div>
</template>

<script setup>
import UserAvatar from './UserAvatar.vue'

defineProps({
  conversations: { type: Array, required: true },
})

defineEmits(['hide'])
</script>

<style scoped>
.conversation-list {
  border-top: 1px solid var(--border);
}

.conversation-item-wrapper {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
  position: relative;
}

.conversation-item-wrapper:hover {
  background: var(--bg-hover);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.conv-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.conv-name {
  font-weight: 600;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-handle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.hide-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.4rem 0.75rem;
  flex-shrink: 0;
  line-height: 1;
}

.conversation-item-wrapper:hover .hide-btn {
  display: block;
}

.hide-btn:hover {
  color: var(--danger);
}

.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
