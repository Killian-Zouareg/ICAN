<template>
  <div class="ghost-profile-page">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <template v-else-if="profile">
      <div class="ghost-banner"></div>
      <div class="ghost-info">
        <UserAvatar
          :url="null"
          :name="profile.display_name"
          :size="72"
          class="ghost-avatar"
        />
        <div class="ghost-names">
          <span class="ghost-display-name">{{ profile.display_name }}</span>
          <span class="ghost-handle">@{{ profile.username }}</span>
        </div>
        <p class="ghost-bio">Ce compte est inactif.</p>
      </div>
    </template>

    <div v-else class="empty">Profil introuvable.</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGhostEngagementStore } from '../stores/ghostEngagement'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const ghostStore = useGhostEngagementStore()

const profile = ref(null)
const loading = ref(true)

onMounted(async () => {
  profile.value = await ghostStore.fetchGhostProfile(route.params.id)
  loading.value = false
})
</script>

<style scoped>
.ghost-profile-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - var(--header-height));
}

.back-bar {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
}

.back-btn:hover {
  text-decoration: underline;
}

.ghost-banner {
  height: 100px;
  background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-secondary) 100%);
}

.ghost-info {
  padding: 0 1.25rem 1.5rem;
  position: relative;
}

.ghost-avatar {
  margin-top: -36px;
  border: 3px solid var(--bg-primary);
  border-radius: 50%;
  display: block;
}

.ghost-names {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.ghost-display-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.ghost-handle {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.ghost-bio {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
}

.loading,
.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}
</style>
