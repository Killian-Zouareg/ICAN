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

<style scoped src="./MessageBubble.css"></style>
