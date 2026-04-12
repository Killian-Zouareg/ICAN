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
      <div class="switcher-profiles-list">
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
      </div>
      <router-link to="/settings" class="switcher-manage" @click="showSwitcher = false">
        G&eacute;rer les profils
      </router-link>
    </div>

    <!-- More menu -->
    <div v-if="showMore" class="mobile-more-menu">
      <router-link to="/map" class="mobile-more-item" @click="showMore = false">
        <span>&#x1F5FA;</span> Carte
      </router-link>
      <router-link :to="`/character/${auth.activeProfile?.username}`" class="mobile-more-item" @click="showMore = false" v-if="auth.activeProfile">
        <span>&#x1F9D9;</span> iCharacter
      </router-link>
      <router-link to="/bank" class="mobile-more-item" @click="showMore = false">
        <span>&#x1F3E6;</span> iBank
      </router-link>
      <router-link to="/wiki" class="mobile-more-item" @click="showMore = false">
        <span>&#x1F4D6;</span> iWiki
      </router-link>
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

<style scoped src="./MobileNav.css"></style>
