<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="logo">Ican</h1>
      <p class="tagline">Partage avec tes amis</p>

      <div class="tabs">
        <button
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >
          Connexion
        </button>
        <button
          :class="{ active: mode === 'signup' }"
          @click="mode = 'signup'"
        >
          Inscription
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div v-if="mode === 'signup'" class="field">
          <label for="username">Nom d'utilisateur</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            placeholder="ton_pseudo"
            autocomplete="username"
          />
        </div>

        <div v-if="mode === 'signup'" class="field">
          <label for="displayName">Nom affiché</label>
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            placeholder="Ton Nom (optionnel)"
          />
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="ton@email.com"
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            placeholder="Min. 6 caractères"
            autocomplete="current-password"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="success" class="success">{{ success }}</p>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login')
const email = ref('')
const password = ref('')
const username = ref('')
const displayName = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

async function handleSubmit() {
  error.value = ''
  success.value = ''
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await auth.signIn(email.value, password.value)
      router.push('/')
    } else {
      const result = await auth.signUp(email.value, password.value, username.value, displayName.value)
      if (result.session) {
        router.push('/')
      } else {
        success.value = 'Compte créé ! Vérifie tes emails pour confirmer ton inscription, puis connecte-toi.'
        mode.value = 'login'
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped src="./LoginView.css"></style>
