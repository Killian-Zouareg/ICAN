<template>
  <div
    class="quoted-comment"
    :class="{ 'quoted-hero': isHero }"
    :style="heroStyles"
    @click.stop="goToPost"
  >
    <div class="quoted-header">
      <UserAvatar
        :url="comment.profiles?.avatar_url || null"
        :name="comment.profiles?.display_name || comment.profiles?.username || '?'"
        :size="18"
      />
      <span class="quoted-name" :class="{ 'hero-name': isHero }" :style="isHero ? heroNameStyle : {}">
        {{ comment.profiles?.display_name }}
        <svg v-if="isHero" class="hero-badge-icon" viewBox="0 0 24 24" aria-label="Hero">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill="currentColor"/>
        </svg>
      </span>
      <span class="quoted-handle">@{{ comment.profiles?.username }}</span>
      <span class="quoted-dot">&middot;</span>
      <span class="quoted-time">{{ timeAgo(comment.created_at) }}</span>
      <span class="quoted-badge">commentaire</span>
    </div>
    <p v-if="comment.content" class="quoted-content">{{ comment.content }}</p>
    <div v-if="comment.image_url" class="quoted-image-wrapper">
      <img :src="comment.image_url" alt="Image du commentaire cité" class="quoted-image" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { timeAgo } from '../lib/time'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  comment: { type: Object, required: true },
})

const router = useRouter()

const isHero = computed(() => props.comment.profiles?.is_hero === true)

const heroStyles = computed(() => {
  if (!isHero.value) return {}
  const primary = props.comment.profiles?.hero_color_primary || '#FFD700'
  const secondary = props.comment.profiles?.hero_color_secondary || '#FF6B00'
  return {
    '--hero-primary': primary,
    '--hero-secondary': secondary,
    '--hero-glow': primary + '40',
  }
})

const heroNameStyle = computed(() => {
  if (!isHero.value) return {}
  const primary = props.comment.profiles?.hero_color_primary || '#FFD700'
  const secondary = props.comment.profiles?.hero_color_secondary || '#FF6B00'
  return {
    background: `linear-gradient(90deg, ${primary}, ${secondary})`,
    '-webkit-background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
    'background-clip': 'text',
  }
})

function goToPost() {
  if (props.comment.post_id) {
    router.push(`/post/${props.comment.post_id}`)
  }
}
</script>

<style scoped src="./QuotedCommentEmbed.css"></style>
