<template>
  <div class="composer">
    <MentionInput
      v-model="content"
      tag="textarea"
      placeholder="Quoi de neuf ?"
      maxlength="500"
      rows="3"
      @keydown.ctrl.enter="submit"
    />

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
import { useMapLocationsStore } from '../stores/mapLocations'
import { extractLocationIds } from '../lib/locationMentions'
import MentionInput from './MentionInput.vue'

const postsStore = usePostsStore()
const mapStore = useMapLocationsStore()
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
    const locationIds = extractLocationIds(content.value, mapStore.locations)
    await postsStore.createPost(content.value.trim(), imageFile.value, locationIds)
    content.value = ''
    removeImage()
  } catch (e) {
    alert(e.message || 'Erreur lors de la publication')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped src="./PostComposer.css"></style>
