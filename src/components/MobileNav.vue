<template>
  <nav class="mobile-nav">
    <router-link to="/" class="mobile-nav-item" exact-active-class="active">
      <span class="mobile-nav-icon">&#x1F3E0;</span>
      <span class="mobile-nav-label">Feed</span>
    </router-link>
    <router-link to="/messages" class="mobile-nav-item" active-class="active">
      <span class="mobile-nav-icon">&#x2709;</span>
      <span class="mobile-nav-label">Messages</span>
    </router-link>
    <router-link :to="`/user/${auth.activeProfile?.username}`" class="mobile-nav-item" v-if="auth.activeProfile">
      <span class="mobile-nav-icon">&#x1F464;</span>
      <span class="mobile-nav-label">Profil</span>
    </router-link>
    <router-link to="/settings" class="mobile-nav-item" active-class="active">
      <span class="mobile-nav-icon">&#x2699;</span>
      <span class="mobile-nav-label">R&eacute;glages</span>
    </router-link>
    <button class="mobile-nav-item" @click="showMore = !showMore" :class="{ active: showMore }">
      <span class="mobile-nav-icon">&#x2022;&#x2022;&#x2022;</span>
      <span class="mobile-nav-label">Plus</span>
    </button>

    <!-- More menu -->
    <div v-if="showMore" class="mobile-more-menu">
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

const auth = useAuthStore()
const router = useRouter()
const showMore = ref(false)

async function handleLogout() {
  showMore.value = false
  await auth.signOut()
  router.push('/login')
}

function handleClickOutside(e) {
  if (!e.target.closest('.mobile-nav')) {
    showMore.value = false
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

  .mobile-nav-label {
    font-size: 0.6rem;
    margin-top: 0.15rem;
  }

  .mobile-nav-item.active {
    color: var(--accent);
  }

  /* More menu */
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
