<template>
  <form class="comment-form" @submit.prevent="submit">
    <input
      v-model="content"
      type="text"
      placeholder="Ajouter un commentaire..."
      maxlength="300"
    />
    <button type="submit" :disabled="!content.trim() || submitting">
      {{ submitting ? '...' : 'Envoyer' }}
    </button>
  </form>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['submit'])
const content = ref('')
const submitting = ref(false)

async function submit() {
  if (!content.value.trim()) return
  submitting.value = true
  emit('submit', content.value.trim())
  content.value = ''
  submitting.value = false
}
</script>

<style scoped>
.comment-form {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
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

button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
