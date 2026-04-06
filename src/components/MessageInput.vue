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

<style scoped>
.msg-input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
}

.message-input {
  display: flex;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  align-items: center;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  padding: 0.45rem;
  border-radius: 9999px;
  line-height: 0;
  transition: background 0.15s;
  flex-shrink: 0;
}

.action-btn:hover {
  background: rgba(29, 161, 242, 0.1);
}

input[type="text"] {
  flex: 1;
  padding: 0.7rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 9999px;
  color: var(--text-primary);
  font-size: 0.94rem;
  transition: border-color 0.15s;
}

input[type="text"]::placeholder {
  color: var(--text-secondary);
}

input[type="text"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(29, 161, 242, 0.15);
}

.send-btn {
  background: var(--accent);
  color: white;
  border: none;
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, opacity 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.image-preview {
  padding: 0.5rem 1rem 0;
}

.image-preview-wrap {
  display: inline-flex;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.image-preview img {
  max-height: 100px;
  display: block;
}

.remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.65);
  border: none;
  color: white;
  font-size: 1rem;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.15s;
}

.remove-image:hover {
  background: rgba(224, 36, 94, 0.9);
}
</style>
