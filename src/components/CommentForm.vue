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

<style scoped src="./CommentForm.css"></style>
