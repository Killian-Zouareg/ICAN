<template>
  <div class="comments">
    <div v-if="comments.length === 0" class="empty">Aucun commentaire</div>
    <div v-for="comment in comments" :key="comment.id" class="comment">
      <div class="comment-header">
        <router-link
          :to="`/user/${comment.profiles.username}`"
          class="comment-author"
        >
          {{ comment.profiles.display_name }}
        </router-link>
        <span class="comment-handle">@{{ comment.profiles.username }}</span>
        <span class="dot">·</span>
        <span class="comment-time">{{ timeAgo(comment.created_at) }}</span>
        <button
          v-if="canDeleteComment(comment)"
          class="delete-btn"
          @click="$emit('delete', comment.id)"
        >
          &#x1F5D1;
        </button>
      </div>
      <p class="comment-text">{{ comment.content }}</p>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'

defineProps({
  comments: { type: Array, required: true },
})

defineEmits(['delete'])

const auth = useAuthStore()

function canDeleteComment(comment) {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(comment.author_id) || auth.isAdmin
}
</script>

<style scoped>
.comments {
  border-top: 1px solid var(--border);
}

.comment {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.comment-author {
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.9rem;
}

.comment-author:hover {
  text-decoration: underline;
}

.comment-handle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.dot {
  color: var(--text-secondary);
}

.comment-time {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
}

.delete-btn:hover {
  color: var(--danger);
}

.comment-text {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
