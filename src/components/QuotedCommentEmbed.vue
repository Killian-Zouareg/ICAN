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

<style scoped>
.quoted-comment {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  margin-top: 0.5rem;
  cursor: pointer;
  transition: background 0.15s;
  background: var(--bg-primary);
}

.quoted-comment:hover {
  background: var(--bg-hover);
}

/* Hero quoted comment */
.quoted-comment.quoted-hero {
  position: relative;
  border: none;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--hero-primary) 8%, var(--bg-primary)),
    color-mix(in srgb, var(--hero-secondary) 5%, var(--bg-primary))
  );
  box-shadow: 0 0 8px var(--hero-glow);
  z-index: 0;
}

.quoted-comment.quoted-hero:hover {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--hero-primary) 14%, var(--bg-primary)),
    color-mix(in srgb, var(--hero-secondary) 10%, var(--bg-primary))
  );
  box-shadow: 0 0 14px var(--hero-glow);
}

.quoted-comment.quoted-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  padding: 1.5px;
  background: linear-gradient(135deg, var(--hero-primary), var(--hero-secondary), var(--hero-primary));
  background-size: 200% 200%;
  animation: hero-gradient-shift 3s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: -1;
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
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.quoted-name.hero-name {
  font-weight: 800;
}

.hero-badge-icon {
  width: 14px;
  height: 14px;
  color: var(--hero-primary, #FFD700);
  flex-shrink: 0;
  filter: drop-shadow(0 0 2px var(--hero-primary, #FFD700));
}

.quoted-handle,
.quoted-dot,
.quoted-time {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.quoted-badge {
  font-size: 0.7rem;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 0 0.4rem;
  margin-left: 0.25rem;
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
