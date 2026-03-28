<template>
  <div class="bubble" :class="{ mine: isMine }">
    <p class="bubble-text">{{ message.content }}</p>
    <span class="bubble-time">{{ timeAgo(message.created_at) }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'

const props = defineProps({
  message: { type: Object, required: true },
})

const auth = useAuthStore()
const isMine = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.message.sender_id)
})
</script>

<style scoped>
.bubble {
  max-width: 75%;
  padding: 0.5rem 0.75rem;
  border-radius: 16px;
  margin-bottom: 0.5rem;
  background: var(--bg-hover);
  align-self: flex-start;
}

.bubble.mine {
  background: var(--accent);
  color: white;
  align-self: flex-end;
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
