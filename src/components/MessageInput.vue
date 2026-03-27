<template>
  <form class="message-input" @submit.prevent="submit">
    <input
      v-model="content"
      type="text"
      placeholder="Écrire un message..."
      maxlength="1000"
    />
    <button type="submit" :disabled="!content.trim()">Envoyer</button>
  </form>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['send'])
const content = ref('')

function submit() {
  if (!content.value.trim()) return
  emit('send', content.value.trim())
  content.value = ''
}
</script>

<style scoped>
.message-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

input {
  flex: 1;
  padding: 0.6rem 0.75rem;
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
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
