<template>
  <div class="quote-overlay" @click.self="$emit('close')">
    <div class="quote-modal">
      <div class="quote-modal-header">
        <span class="quote-modal-title">Citer</span>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="quote-modal-body">
        <div class="composer-row">
          <UserAvatar
            v-if="auth.activeProfile"
            :url="auth.activeProfile.avatar_url"
            :name="auth.activeProfile.display_name || auth.activeProfile.username || '?'"
            :size="36"
          />
          <textarea
            v-model="content"
            placeholder="Ajoutez votre commentaire..."
            maxlength="500"
            rows="3"
            class="quote-textarea"
            @keydown.ctrl.enter="submit"
          ></textarea>
        </div>

        <!-- Image preview -->
        <div v-if="imagePreview" class="image-preview">
          <img :src="imagePreview" alt="Preview" />
          <button class="remove-image" @click="removeImage">&times;</button>
        </div>

        <!-- Quoted post or comment embed -->
        <QuotedPostEmbed v-if="quotedPost" :post="quotedPost" />
        <QuotedCommentEmbed v-else-if="quotedComment" :comment="quotedComment" />

        <div class="quote-footer">
          <div class="footer-left">
            <button class="icon-btn" @click="triggerFileInput" title="Ajouter une image">
              <span class="img-icon">&#x1F5BC;</span>
            </button>
            <span class="char-count" :class="{ warn: content.length > 450 }">
              {{ content.length }}/500
            </span>
          </div>
          <button
            class="publish-btn"
            @click="submit"
            :disabled="(!content.trim() && !imageFile) || submitting"
          >
            {{ submitting ? '...' : 'Publier' }}
          </button>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style="display: none"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePostsStore } from '../stores/posts'
import { useAuthStore } from '../stores/auth'
import { useMapLocationsStore } from '../stores/mapLocations'
import { extractLocationIds } from '../lib/locationMentions'
import UserAvatar from './UserAvatar.vue'
import QuotedPostEmbed from './QuotedPostEmbed.vue'
import QuotedCommentEmbed from './QuotedCommentEmbed.vue'

const props = defineProps({
  quotedPost: { type: Object, default: null },
  quotedComment: { type: Object, default: null },
})

const emit = defineEmits(['close', 'published'])

const postsStore = usePostsStore()
const auth = useAuthStore()
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
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  e.target.value = ''
}

function removeImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = null
  imagePreview.value = null
}

async function submit() {
  if (!content.value.trim() && !imageFile.value) return
  submitting.value = true
  try {
    const quoteOfId = props.quotedPost?.id || null
    const quoteCommentId = props.quotedComment?.id || null
    const locationIds = extractLocationIds(content.value, mapStore.locations)
    await postsStore.createQuotePost(content.value.trim(), quoteOfId, quoteCommentId, imageFile.value, locationIds)
    emit('published')
    emit('close')
  } catch (e) {
    alert(e.message || 'Erreur lors de la publication')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped src="./QuoteComposer.css"></style>
