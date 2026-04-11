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

        <p class="comment-text" v-html="renderMentions(comment.content)"></p>

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
            @mousedown="animateClick($event)"
          >
            <span class="icon">
              <!-- Modern comment SVG -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span v-if="replies.length > 0">{{ replies.length }}</span>
          </button>

          <button
            class="action-btn like-btn"
            :class="{ active: hasLiked }"
            @click="$emit('toggle-like', comment.id)"
            @mousedown="animateClick($event)"
          >
            <span class="icon">
              <!-- Modern like SVG (filled if liked) -->
              <svg v-if="hasLiked" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M12 21s-5.05-4.36-7.07-7.07C2.4 11.13 2 9.6 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 1.01 4.5 2.09C13.09 4.01 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.1-.4 2.63-2.93 5.43C17.05 16.64 12 21 12 21z"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M12 21s-5.05-4.36-7.07-7.07C2.4 11.13 2 9.6 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 1.01 4.5 2.09C13.09 4.01 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 1.1-.4 2.63-2.93 5.43C17.05 16.64 12 21 12 21z"/>
              </svg>
            </span>
            <span v-if="likeCount > 0">{{ likeCount }}</span>
          </button>

          <button
            class="action-btn quote-btn"
            @click="$emit('quote', comment)"
            @mousedown="animateClick($event)"
            title="Citer"
          >
            <span class="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </span>
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
        @quote="(c) => $emit('quote', c)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../lib/time'
import { renderMentions } from '../lib/mentionRenderer'
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

defineEmits(['reply', 'toggle-like', 'delete', 'quote'])

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

// Animation de clic sur les boutons d'action
function animateClick(event) {
  const btn = event.currentTarget
  btn.classList.remove('clicked')
  // Force reflow to restart animation
  void btn.offsetWidth
  btn.classList.add('clicked')
}
</script>

<style scoped src="./CommentCard.css"></style>
