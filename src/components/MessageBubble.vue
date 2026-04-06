<template>
  <div class="bubble-wrapper" :class="{ mine: isMine }">
    <button
      v-if="isMine || auth.isAdmin"
      class="delete-btn"
      @click="$emit('delete', message.id)"
      title="Supprimer"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
    </button>
    <div class="bubble" :class="{ mine: isMine }">
      <img
        v-if="message.image_url"
        :src="message.image_url"
        alt="Image"
        class="bubble-image"
        @click="openImage(message.image_url)"
      />
      <p v-if="message.content" class="bubble-text">{{ message.content }}</p>
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

function openImage(url) {
  window.open(url, '_blank')
}
</script>

<style scoped>
.bubble-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  align-self: flex-start;
  max-width: 70%;
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
  padding: 0.35rem;
  border-radius: 9999px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}

.delete-btn:hover {
  color: var(--danger);
  background: rgba(224, 36, 94, 0.1);
  opacity: 1;
}

.bubble-wrapper:hover .delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.bubble {
  padding: 0.65rem 1rem;
  border-radius: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  position: relative;
}

/* Other user: rounded top-left flat */
.bubble-wrapper:not(.mine) .bubble {
  border-bottom-left-radius: 6px;
}

/* Mine: rounded top-right flat */
.bubble-wrapper.mine .bubble {
  border-bottom-right-radius: 6px;
}

.bubble.mine {
  background: var(--accent);
  color: white;
  border-color: transparent;
}

.bubble-image {
  max-width: 100%;
  max-height: 320px;
  border-radius: 12px;
  cursor: pointer;
  display: block;
  margin-bottom: 0.35rem;
  transition: opacity 0.15s;
}

.bubble-image:hover {
  opacity: 0.9;
}

.bubble-text {
  font-size: 0.94rem;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.45;
  margin: 0;
}

.bubble-time {
  font-size: 0.72rem;
  opacity: 0.6;
  display: block;
  margin-top: 0.25rem;
}
</style>
