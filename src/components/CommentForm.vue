<template>
  <div class="comment-form-wrapper">
    <div v-if="replyingTo" class="reply-indicator">
      <span>En r&eacute;ponse &agrave; <strong>@{{ replyingTo.profiles.username }}</strong></span>
      <button class="cancel-reply" @click="$emit('cancel-reply')">&times;</button>
    </div>
    <form class="comment-form" @submit.prevent="submit">
      <UserAvatar
        v-if="auth.activeProfile"
        :url="auth.activeProfile.avatar_url"
        :name="auth.activeProfile.display_name || auth.activeProfile.username || '?'"
        :size="32"
      />
      <input
        ref="inputRef"
        v-model="content"
        type="text"
        :placeholder="replyingTo ? `R\u00e9pondre \u00e0 @${replyingTo.profiles.username}...` : 'Ajouter un commentaire...'"
        maxlength="300"
      />
      <button type="submit" :disabled="!content.trim() || submitting">
        {{ submitting ? '...' : 'Envoyer' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  replyingTo: { type: Object, default: null },
})

const emit = defineEmits(['submit', 'cancel-reply'])
const auth = useAuthStore()
const content = ref('')
const submitting = ref(false)
const inputRef = ref(null)

watch(
  () => props.replyingTo,
  (val) => {
    if (val && inputRef.value) {
      inputRef.value.focus()
    }
  }
)

async function submit() {
  if (!content.value.trim()) return
  submitting.value = true
  emit('submit', content.value.trim())
  content.value = ''
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

.comment-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
}

input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

input:focus {
  outline: none;
  border-color: var(--accent);
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
