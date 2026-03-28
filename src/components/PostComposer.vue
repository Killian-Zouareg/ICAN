<template>
  <div class="composer">
    <textarea
      v-model="content"
      placeholder="Quoi de neuf ?"
      maxlength="500"
      rows="3"
      @keydown.ctrl.enter="submit"
    ></textarea>

    <!-- Image preview -->
    <div v-if="imagePreview" class="image-preview">
      <img :src="imagePreview" alt="Preview" />
      <button class="remove-image" @click="removeImage">&times;</button>
    </div>

    <div class="composer-footer">
      <div class="footer-left">
        <button class="icon-btn" @click="triggerFileInput" title="Ajouter une image">
          <span class="img-icon">&#x1F5BC;</span>
        </button>
        <span class="char-count" :class="{ warn: content.length > 450 }">
          {{ content.length }}/500
        </span>
      </div>
      <button class="publish-btn" @click="submit" :disabled="(!content.trim() && !imageFile) || submitting">
        {{ submitting ? '...' : 'Publier' }}
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePostsStore } from '../stores/posts'

const postsStore = usePostsStore()
const content = ref('')
const submitting = ref(false)
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }

  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  // Reset input so same file can be re-selected
  e.target.value = ''
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = null
}

async function submit() {
  if (!content.value.trim() && !imageFile.value) return
  submitting.value = true
  try {
    await postsStore.createPost(content.value.trim(), imageFile.value)
    content.value = ''
    removeImage()
  } catch (e) {
    alert(e.message || 'Erreur lors de la publication')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.composer {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

textarea {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  resize: vertical;
  min-height: 60px;
}

textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.image-preview {
  position: relative;
  margin-top: 0.5rem;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 300px;
}

.image-preview img {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  display: block;
}

.remove-image {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.remove-image:hover {
  background: rgba(0, 0, 0, 0.9);
}

.composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--bg-hover);
}

.img-icon {
  font-size: 1.3rem;
  filter: grayscale(0.3);
}

.char-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.char-count.warn {
  color: var(--danger);
}

.publish-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.4rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.publish-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
</style>
