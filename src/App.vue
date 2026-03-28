<template>
  <div v-if="auth.loading" class="loading">Chargement...</div>
  <template v-else>
    <AppHeader v-if="auth.isAuthenticated" />
    <main class="container">
      <router-view />
    </main>
    <DmWidget v-if="auth.isAuthenticated" />
  </template>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import AppHeader from './components/AppHeader.vue'
import DmWidget from './components/DmWidget.vue'

const auth = useAuthStore()
</script>
