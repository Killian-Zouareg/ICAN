<template>
  <div>
    <div v-if="imagePreview" class="image-preview">
      <img :src="imagePreview" alt="Preview" />
      <button class="remove-image" @click="removeImage">&times;</button>
    </div>
    <form class="message-input" @submit.prevent="submit">
      <button type="button" class="img-btn" @click="$refs.fileInput.click()" title="Envoyer une image">
        &#x1F5BC;
      </button>
      <input
        v-model="content"
        type="text"
        placeholder="&Eacute;crire un message..."
        maxlength="1000"
      />
      <button type="submit" :disabled="!content.trim() && !imageFile">Envoyer</button>
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
.message-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  align-items: center;
}

.img-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem 0.3rem;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.img-btn:hover {
  opacity: 1;
}

input[type="text"] {
  flex: 1;
  padding: 0.6rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

input[type="text"]:focus {
  outline: none;
  border-color: var(--accent);
}

button[type="submit"] {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
}

button[type="submit"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

.image-preview img {
  max-height: 80px;
  border-radius: 8px;
}

.remove-image {
  background: none;
  border: none;
  color: var(--danger);
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
}
</style>
