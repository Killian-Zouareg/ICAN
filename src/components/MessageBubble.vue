<template>
  <div class="bubble-wrapper" :class="{ mine: isMine }">
    <button
      v-if="isMine || auth.isAdmin"
      class="delete-btn"
      @click="$emit('delete', message.id)"
      title="Supprimer"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
    </button>
    <div class="bubble" :class="{ mine: isMine }">
      <p class="bubble-text">{{ message.content }}</p>
      <span class="bubble-time">{{ timeAgo(message.created_at) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'

const props = defineProps({
  message: { type: Object, required: true },
})

defineEmits(['delete'])

const auth = useAuthStore()
const isMine = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.message.sender_id)
})
</script>

<style scoped>
.bubble-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
  align-self: flex-start;
  max-width: 75%;
}

.bubble-wrapper.mine {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.delete-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.15s, color 0.15s;
}

.delete-btn:hover {
  color: var(--danger);
  opacity: 1;
}

.bubble-wrapper:hover .delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.bubble {
  padding: 0.5rem 0.75rem;
  border-radius: 16px;
  background: var(--bg-hover);
}

.bubble.mine {
  background: var(--accent);
  color: white;
}

.bubble-text {
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-time {
  font-size: 0.7rem;
  opacity: 0.7;
  display: block;
  margin-top: 0.15rem;
}
</style>
