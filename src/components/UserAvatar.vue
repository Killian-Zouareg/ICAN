<template>
  <div class="user-avatar" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="url" :src="url" alt="Avatar" />
    <span v-else class="initial" :style="{ fontSize: size * 0.45 + 'px' }">
      {{ initial }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  url: { type: String, default: null },
  name: { type: String, default: '?' },
  size: { type: Number, default: 40 },
})

const initial = computed(() => props.name.charAt(0).toUpperCase())
</script>

<style scoped>
.user-avatar {
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initial {
  line-height: 1;
}
</style>
