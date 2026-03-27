<template>
  <div class="composer">
    <textarea
      v-model="content"
      placeholder="Quoi de neuf ?"
      maxlength="500"
      rows="3"
      @keydown.ctrl.enter="submit"
    ></textarea>
    <div class="composer-footer">
      <span class="char-count" :class="{ warn: content.length > 450 }">
        {{ content.length }}/500
      </span>
      <button @click="submit" :disabled="!content.trim() || submitting">
        {{ submitting ? '...' : 'Publier' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePostsStore } from '../stores/posts'

const postsStore = usePostsStore()
const content = ref('')
const submitting = ref(false)

async function submit() {
  if (!content.value.trim()) return
  submitting.value = true
  try {
    await postsStore.createPost(content.value.trim())
    content.value = ''
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

.composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.char-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.char-count.warn {
  color: var(--danger);
}

button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.4rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: var(--accent-hover);
}
</style>
