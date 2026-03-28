<template>
  <div class="comments">
    <div v-if="comments.length === 0" class="empty">Aucun commentaire</div>
    <template v-else>
      <CommentCard
        v-for="comment in topLevelComments"
        :key="comment.id"
        :comment="comment"
        :replies="getReplies(comment.id)"
        :all-comments="comments"
        :comment-likes="commentLikes"
        @reply="(c) => $emit('reply', c)"
        @toggle-like="(id) => $emit('toggle-like', id)"
        @delete="(id) => $emit('delete', id)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CommentCard from './CommentCard.vue'

const props = defineProps({
  comments: { type: Array, required: true },
  commentLikes: { type: Set, default: () => new Set() },
})

defineEmits(['reply', 'toggle-like', 'delete'])

const topLevelComments = computed(() =>
  props.comments.filter((c) => !c.parent_id)
)

function getReplies(commentId) {
  return props.comments.filter((c) => c.parent_id === commentId)
}
</script>

<style scoped>
.comments {
  border-top: 1px solid var(--border);
}

.empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
