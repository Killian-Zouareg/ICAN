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

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.login-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  margin: 1rem;
}

.logo {
  text-align: center;
  font-size: 2rem;
  color: var(--accent);
  margin: 0;
}

.tagline {
  text-align: center;
  color: var(--text-secondary);
  margin: 0.25rem 0 1.5rem;
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.tabs button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
}

.tabs button.active {
  background: var(--accent);
  color: white;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.field input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  box-sizing: border-box;
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.error {
  color: var(--danger);
  font-size: 0.85rem;
  margin: 0.5rem 0;
}

.success {
  color: var(--success);
  font-size: 0.85rem;
  margin: 0.5rem 0;
}

.submit-btn {
  width: 100%;
  padding: 0.7rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
