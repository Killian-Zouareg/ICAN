<template>
  <div class="quoted-post" @click.stop="goToPost">
    <div class="quoted-header">
      <UserAvatar
        :url="post.avatar_url"
        :name="post.display_name || post.username || '?'"
        :size="18"
      />
      <span class="quoted-name">{{ post.display_name }}</span>
      <span class="quoted-handle">@{{ post.username }}</span>
      <span class="quoted-dot">&middot;</span>
      <span class="quoted-time">{{ timeAgo(post.created_at) }}</span>
    </div>
    <p v-if="post.content" class="quoted-content">{{ post.content }}</p>
    <div v-if="post.image_url" class="quoted-image-wrapper">
      <img :src="post.image_url" alt="Image du post cité" class="quoted-image" />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  post: { type: Object, required: true },
})

const router = useRouter()

function goToPost() {
  router.push(`/post/${props.post.id}`)
}
</script>

<style scoped>
.quoted-post {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  margin-top: 0.5rem;
  cursor: pointer;
  transition: background 0.15s;
  background: var(--bg-primary);
}

.quoted-post:hover {
  background: var(--bg-hover);
}

.quoted-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.quoted-name {
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--text-primary);
}

.quoted-handle,
.quoted-dot,
.quoted-time {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.quoted-content {
  font-size: 0.88rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
  margin: 0;
}

.quoted-image-wrapper {
  margin-top: 0.4rem;
  border-radius: 8px;
  overflow: hidden;
}

.quoted-image {
  width: 100%;
  max-height: 150px;
  object-fit: cover;
  display: block;
}
</style>
