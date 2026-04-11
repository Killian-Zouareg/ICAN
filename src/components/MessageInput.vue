<template>
  <div class="msg-input-area">
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
      <input
        v-model="content"
        type="text"
        placeholder="&Eacute;crire un message..."
        maxlength="1000"
        @keydown.enter.exact.prevent="submit"
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
import { ref } from 'vue'

const emit = defineEmits(['send'])
const content = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)

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

function submit() {
  if (!content.value.trim() && !imageFile.value) return
  emit('send', { content: content.value.trim(), imageFile: imageFile.value })
  content.value = ''
  removeImage()
}
</script>

<style scoped src="./MessageInput.css"></style>
