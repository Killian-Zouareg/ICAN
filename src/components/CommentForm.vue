<template>
  <div class="comment-form-wrapper">
    <div v-if="replyingTo" class="reply-indicator">
      <span>En r&eacute;ponse &agrave; <strong>@{{ replyingTo.profiles.username }}</strong></span>
      <button class="cancel-reply" @click="$emit('cancel-reply')">&times;</button>
    </div>

    <!-- Image preview -->
    <div v-if="imagePreview" class="image-preview">
      <img :src="imagePreview" alt="Preview" />
      <button class="remove-image" @click="removeImage">&times;</button>
    </div>

    <form class="comment-form" @submit.prevent="submit">
      <UserAvatar
        v-if="auth.activeProfile"
        :url="auth.activeProfile.avatar_url"
        :name="auth.activeProfile.display_name || auth.activeProfile.username || '?'"
        :size="32"
      />
      <MentionInput
        ref="inputRef"
        v-model="content"
        tag="input"
        type="text"
        :placeholder="replyingTo ? `R\u00e9pondre \u00e0 @${replyingTo.profiles.username}...` : 'Ajouter un commentaire...'"
        maxlength="300"
      />
      <button type="button" class="icon-btn" @click="triggerFileInput" title="Ajouter une image">
        <span class="img-icon">&#x1F5BC;</span>
      </button>
      <button type="submit" :disabled="(!content.trim() && !imageFile) || submitting">
        {{ submitting ? '...' : 'Envoyer' }}
      </button>
    </form>

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
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import UserAvatar from './UserAvatar.vue'
import MentionInput from './MentionInput.vue'

const props = defineProps({
  replyingTo: { type: Object, default: null },
})

const emit = defineEmits(['submit', 'cancel-reply'])
const auth = useAuthStore()
const content = ref('')
const submitting = ref(false)
const inputRef = ref(null)
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

watch(
  () => props.replyingTo,
  (val) => {
    if (val && inputRef.value) {
      inputRef.value.focus()
    }
  }
)

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
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = null
}

async function submit() {
  if (!content.value.trim() && !imageFile.value) return
  submitting.value = true
  emit('submit', content.value.trim(), imageFile.value)
  content.value = ''
  removeImage()
  submitting.value = false
}
</script>

<style scoped>
.comment-form-wrapper {
  border-top: 1px solid var(--border);
}

.reply-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 1rem;
  background: var(--bg-hover);
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.cancel-reply {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0 0.25rem;
}

.cancel-reply:hover {
  color: var(--danger);
}

.image-preview {
  position: relative;
  margin: 0.5rem 1rem 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 150px;
}

.image-preview img {
  width: 100%;
  max-height: 150px;
  object-fit: cover;
  display: block;
}

.remove-image {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.remove-image:hover {
  background: rgba(0, 0, 0, 0.9);
}

.comment-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
}

input[type="text"] {
  flex: 1;
  padding: 0.5rem 0.75rem;
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
  font-size: 1.15rem;
  filter: grayscale(0.3);
}

button[type='submit'] {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
