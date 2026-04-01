<template>
  <div class="comment-card" :class="{ 'is-reply': isReply }">
    <div class="comment-body">
      <router-link :to="ghost ? `/ghost/${comment.ghost_profile_id}` : `/user/${comment.profiles.username}`" @click.stop>
        <UserAvatar
          :url="comment.profiles.avatar_url"
          :name="comment.profiles.display_name || comment.profiles.username || '?'"
          :size="isReply ? 28 : 34"
        />
      </router-link>
      <div class="comment-content">
        <div class="comment-header">
          <router-link
            :to="ghost ? `/ghost/${comment.ghost_profile_id}` : `/user/${comment.profiles.username}`"
            class="author-name"
            @click.stop
          >
            {{ comment.profiles.display_name }}
          </router-link>
          <span class="author-handle">@{{ comment.profiles.username }}</span>
          <span class="dot">&middot;</span>
          <span class="comment-time">{{ timeAgo(comment.created_at) }}</span>
        </div>

        <div v-if="comment.parent_id && parentAuthor" class="replying-to">
          En r&eacute;ponse &agrave; <span class="reply-target">@{{ parentAuthor }}</span>
        </div>

        <p class="comment-text">{{ comment.content }}</p>

        <div v-if="comment.image_url" class="comment-image-wrapper" @click.stop>
          <img
            :src="comment.image_url"
            alt="Image du commentaire"
            class="comment-image"
            @click="openImage"
          />
        </div>

        <div v-if="!ghost" class="comment-actions">
          <button
            class="action-btn reply-btn"
            @click="$emit('reply', comment)"
          >
            <span class="icon">&#x1F4AC;</span>
            <span v-if="replies.length > 0">{{ replies.length }}</span>
          </button>

          <button
            class="action-btn like-btn"
            :class="{ active: hasLiked }"
            @click="$emit('toggle-like', comment.id)"
          >
            <span class="icon">{{ hasLiked ? '&#x2764;' : '&#x2661;' }}</span>
            <span v-if="likeCount > 0">{{ likeCount }}</span>
          </button>

          <button
            v-if="canDelete"
            class="action-btn delete-btn"
            @click="$emit('delete', comment.id)"
          >
            <span class="icon">&#x1F5D1;</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Replies -->
    <div v-if="replies.length > 0" class="replies">
      <CommentCard
        v-for="reply in replies"
        :key="reply.id"
        :comment="reply"
        :replies="getReplies(reply.id)"
        :all-comments="allComments"
        :comment-likes="commentLikes"
        :parent-author="comment.profiles.username"
        :is-reply="true"
        @reply="(c) => $emit('reply', c)"
        @toggle-like="(id) => $emit('toggle-like', id)"
        @delete="(id) => $emit('delete', id)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  comment: { type: Object, required: true },
  replies: { type: Array, default: () => [] },
  allComments: { type: Array, default: () => [] },
  commentLikes: { type: Set, default: () => new Set() },
  parentAuthor: { type: String, default: null },
  isReply: { type: Boolean, default: false },
  ghost: { type: Boolean, default: false },
})

defineEmits(['reply', 'toggle-like', 'delete'])

const auth = useAuthStore()

function openImage() {
  window.open(props.comment.image_url, '_blank')
}

const hasLiked = computed(() => props.commentLikes.has(props.comment.id))

const likeCount = computed(() => props.comment.like_count || 0)

const canDelete = computed(() => {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(props.comment.author_id) || auth.isAdmin
})

function getReplies(commentId) {
  return props.allComments.filter((c) => c.parent_id === commentId)
}
</script>

<style scoped>
.comment-card {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
}

.comment-card.is-reply {
  padding: 0.4rem 0 0.4rem 0;
  border-bottom: none;
}

.comment-body {
  display: flex;
  gap: 0.6rem;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.author-name {
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.88rem;
}

.author-name:hover {
  text-decoration: underline;
}

.author-handle {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.dot {
  color: var(--text-secondary);
}

.comment-time {
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.replying-to {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.reply-target {
  color: var(--accent);
}

.comment-text {
  margin: 0.2rem 0 0.35rem;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.comment-actions {
  display: flex;
  gap: 1.2rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.15rem;
}

.action-btn:hover {
  color: var(--accent);
}

.like-btn.active {
  color: var(--danger);
}

.delete-btn:hover {
  color: var(--danger);
}

.icon {
  font-size: 0.95rem;
}

.replies {
  margin-left: 2.5rem;
  border-left: 2px solid var(--border);
  padding-left: 0.75rem;
}

.is-reply .replies {
  margin-left: 2rem;
}

.comment-image-wrapper {
  margin: 0.3rem 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-width: 100%;
}

.comment-image {
  width: 100%;
  max-height: 250px;
  object-fit: cover;
  display: block;
  cursor: pointer;
}

.comment-image:hover {
  opacity: 0.92;
}
</style>
