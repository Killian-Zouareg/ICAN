<template>
  <div
    class="quoted-post"
    :class="{ 'quoted-hero': post.is_hero }"
    :style="heroStyles"
    @click.stop="goToPost"
  >
    <div class="quoted-header">
      <UserAvatar
        :url="post.avatar_url"
        :name="post.display_name || post.username || '?'"
        :size="18"
      />
      <span class="quoted-name" :class="{ 'hero-name': post.is_hero }" :style="post.is_hero ? heroNameStyle : {}">
        {{ post.display_name }}
        <svg v-if="post.is_hero" class="hero-badge-icon" viewBox="0 0 24 24" aria-label="Hero">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill="currentColor"/>
        </svg>
      </span>
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  post: { type: Object, required: true },
})

const router = useRouter()

const heroStyles = computed(() => {
  if (!props.post.is_hero) return {}
  const primary = props.post.hero_color_primary || '#FFD700'
  const secondary = props.post.hero_color_secondary || '#FF6B00'
  return {
    '--hero-primary': primary,
    '--hero-secondary': secondary,
    '--hero-glow': primary + '40',
  }
})

const heroNameStyle = computed(() => {
  if (!props.post.is_hero) return {}
  const primary = props.post.hero_color_primary || '#FFD700'
  const secondary = props.post.hero_color_secondary || '#FF6B00'
  return {
    background: `linear-gradient(90deg, ${primary}, ${secondary})`,
    '-webkit-background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
    'background-clip': 'text',
  }
})

function goToPost() {
  router.push(`/post/${props.post.id}`)
}
</script>

<style scoped src="./QuotedPostEmbed.css"></style>
