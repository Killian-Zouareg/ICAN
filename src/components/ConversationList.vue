<template>
  <div class="conversation-list">
    <div v-if="conversations.length === 0" class="empty">
      Aucune conversation
    </div>
    <router-link
      v-for="conv in conversations"
      :key="conv.id"
      :to="`/messages/${conv.id}`"
      class="conversation-item"
    >
      <div class="conv-avatar">
        {{ conv.otherUser.display_name.charAt(0).toUpperCase() }}
      </div>
      <div class="conv-info">
        <span class="conv-name">{{ conv.otherUser.display_name }}</span>
        <span class="conv-handle">@{{ conv.otherUser.username }}</span>
      </div>
    </router-link>
  </div>
</template>

<script setup>
defineProps({
  conversations: { type: Array, required: true },
})
</script>

<style scoped>
.conversation-list {
  border-top: 1px solid var(--border);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.15s;
}

.conversation-item:hover {
  background: var(--bg-hover);
}

.conv-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.conv-info {
  display: flex;
  flex-direction: column;
}

.conv-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.conv-handle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
