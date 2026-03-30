<template>
  <nav class="mobile-nav">
    <router-link to="/" class="mobile-nav-item" exact-active-class="active">
      <span class="mobile-nav-icon">&#x1F3E0;</span>
      <span class="mobile-nav-label">Feed</span>
    </router-link>
    <router-link to="/search" class="mobile-nav-item" active-class="active">
      <span class="mobile-nav-icon">&#x1F50D;</span>
      <span class="mobile-nav-label">Recherche</span>
    </router-link>
    <router-link to="/messages" class="mobile-nav-item" active-class="active">
      <span class="mobile-nav-icon">&#x2709;</span>
      <span class="mobile-nav-label">Messages</span>
    </router-link>
    <router-link :to="`/user/${auth.activeProfile?.username}`" class="mobile-nav-item" v-if="auth.activeProfile">
      <span class="mobile-nav-icon">&#x1F464;</span>
      <span class="mobile-nav-label">Profil</span>
    </router-link>

    <!-- Profile switcher button -->
    <button class="mobile-nav-item" @click.stop="toggleSwitcher" :class="{ active: showSwitcher }">
      <span class="mobile-nav-avatar">
        <UserAvatar :url="auth.activeProfile?.avatar_url" :name="auth.activeProfile?.display_name" :size="22" />
      </span>
      <span class="mobile-nav-label">Compte</span>
    </button>

    <!-- More menu button -->
    <button class="mobile-nav-item" @click.stop="toggleMore" :class="{ active: showMore }">
      <span class="mobile-nav-icon">&#x2022;&#x2022;&#x2022;</span>
      <span class="mobile-nav-label">Plus</span>
    </button>

    <!-- Profile switcher popup -->
    <div v-if="showSwitcher" class="mobile-switcher-menu" @click.stop>
      <div class="switcher-header">Changer de compte</div>
      <div
        v-for="p in auth.profiles"
        :key="p.id"
        class="switcher-profile"
        :class="{ active: p.id === auth.activeProfile?.id }"
        @click="selectProfile(p.id)"
      >
        <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="36" />
        <div class="switcher-info">
          <span class="switcher-name">{{ p.display_name }}</span>
          <span class="switcher-handle">@{{ p.username }}</span>
        </div>
        <span v-if="p.id === auth.activeProfile?.id" class="switcher-check">&#x2713;</span>
      </div>
      <router-link to="/settings" class="switcher-manage" @click="showSwitcher = false">
        G&eacute;rer les profils
      </router-link>
    </div>

    <!-- More menu -->
    <div v-if="showMore" class="mobile-more-menu">
      <router-link to="/settings" class="mobile-more-item" @click="showMore = false">
        <span>&#x2699;</span> Param&egrave;tres
      </router-link>
      <router-link to="/patch-notes" class="mobile-more-item" @click="showMore = false">
        <span>&#x1F4CB;</span> Patch Notes
      </router-link>
      <router-link v-if="auth.isAdmin" to="/admin" class="mobile-more-item" @click="showMore = false">
        <span>&#x1F6E1;</span> Admin
      </router-link>
      <button class="mobile-more-item logout" @click="handleLogout">
        <span>&#x1F6AA;</span> Quitter
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()
const showMore = ref(false)
const showSwitcher = ref(false)

function toggleMore() {
  showMore.value = !showMore.value
  if (showMore.value) showSwitcher.value = false
}

function toggleSwitcher() {
  showSwitcher.value = !showSwitcher.value
  if (showSwitcher.value) showMore.value = false
}

function selectProfile(profileId) {
  auth.switchProfile(profileId)
  showSwitcher.value = false
  router.push('/')
}

async function handleLogout() {
  showMore.value = false
  await auth.signOut()
  router.push('/login')
}

function handleClickOutside(e) {
  if (!e.target.closest('.mobile-nav')) {
    showMore.value = false
    showSwitcher.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.mobile-nav {
  display: none;
}

@media (max-width: 768px) {
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    z-index: 100;
    justify-content: space-around;
    padding: 0.3rem 0;
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
    text-decoration: none;
    color: var(--text-secondary);
    transition: all 0.15s;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .mobile-nav-icon {
    font-size: 1.15rem;
    line-height: 1;
  }

  .mobile-nav-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

  .mobile-nav-label {
    font-size: 0.6rem;
    margin-top: 0.15rem;
  }

  .mobile-nav-item.active {
    color: var(--accent);
  }

  /* ---- Profile switcher popup ---- */
  .mobile-switcher-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 8px;
    right: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    z-index: 200;
  }

  .switcher-header {
    padding: 0.75rem 1rem;
    font-weight: 700;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--border);
  }

  .switcher-profile {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.65rem 1rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .switcher-profile:hover {
    background: var(--bg-hover);
  }

  .switcher-profile.active {
    background: var(--bg-hover);
  }

  .switcher-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .switcher-name {
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .switcher-handle {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .switcher-check {
    color: var(--accent);
    font-size: 1rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .switcher-manage {
    display: block;
    text-align: center;
    padding: 0.65rem;
    border-top: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--accent);
    text-decoration: none;
  }

  .switcher-manage:hover {
    background: var(--bg-hover);
    text-decoration: none;
  }

  /* ---- More menu ---- */
  .mobile-more-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    min-width: 180px;
    z-index: 200;
  }

  .mobile-more-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 1rem;
    text-decoration: none;
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: background 0.15s;
    border: none;
    background: none;
    width: 100%;
    cursor: pointer;
    font-family: inherit;
  }

  .mobile-more-item:hover {
    background: var(--bg-hover);
    text-decoration: none;
  }

  .mobile-more-item.logout {
    color: var(--danger);
    border-top: 1px solid var(--border);
  }
}
</style>
