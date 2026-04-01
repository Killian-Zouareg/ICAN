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
    await postsStore.createQuotePost(content.value.trim(), quoteOfId, quoteCommentId, imageFile.value)
    emit('published')
    emit('close')
  } catch (e) {
    alert(e.message || 'Erreur lors de la publication')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.quote-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quote-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.quote-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.quote-modal-title {
  font-weight: 700;
  font-size: 1rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--danger);
}

.quote-modal-body {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.composer-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.quote-textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  resize: none;
  min-height: 70px;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.quote-textarea::placeholder {
  color: var(--text-secondary);
}

.image-preview {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 200px;
}

.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  display: block;
}

.remove-image {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image:hover {
  background: rgba(0, 0, 0, 0.9);
}

.quote-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border);
  margin-top: 0.25rem;
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
  font-weight: 600;
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
