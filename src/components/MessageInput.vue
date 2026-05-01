<template>
  <div class="msg-input-area">
    <!-- Reply banner -->
    <div v-if="replyingTo" class="reply-banner">
      <div class="reply-info">
        <span class="reply-label">Réponse à <strong>{{ replyingTo.sender?.display_name || '?' }}</strong></span>
        <span class="reply-preview">{{ replyPreview }}</span>
      </div>
      <button class="reply-cancel" @click="$emit('cancel-reply')" title="Annuler la réponse">&times;</button>
    </div>

    <div v-if="imagePreview" class="image-preview">
      <div class="image-preview-wrap">
        <img :src="imagePreview" alt="Preview" />
        <button class="remove-image" @click="removeImage">&times;</button>
      </div>
    </div>
    <form class="message-input" @submit.prevent="submit">
      <button type="button" class="action-btn" @click="$refs.fileInput.click()" title="Envoyer une image">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <MentionInput
        v-model="content"
        tag="input"
        dropdown-position="top"
        type="text"
        :placeholder="replyingTo ? 'Répondre...' : 'Écrire un message...'"
        maxlength="1000"
        @keydown.enter.exact="onEnter"
      />
      <button type="submit" class="send-btn" :disabled="!content.trim() && !imageFile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MentionInput from './MentionInput.vue'

const props = defineProps({
  replyingTo: { type: Object, default: null },
})

const emit = defineEmits(['send', 'cancel-reply'])
const content = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)

const replyPreview = computed(() => {
  if (!props.replyingTo) return ''
  const c = props.replyingTo.content || ''
  if (!c) return props.replyingTo.image_url ? '🖼️ Image' : ''
  return c.length > 60 ? c.slice(0, 60) + '...' : c
})

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = null
}

function onEnter(e) {
  // If MentionInput's dropdown handled Enter (to pick a suggestion), skip submit
  if (e.defaultPrevented) return
  e.preventDefault()
  submit()
}

function submit() {
  if (!content.value.trim() && !imageFile.value) return
  emit('send', { content: content.value.trim(), imageFile: imageFile.value })
  content.value = ''
  removeImage()
}
</script>

<style scoped src="./MessageInput.css"></style>
