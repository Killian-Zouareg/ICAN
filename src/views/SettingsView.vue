<template>
  <div class="settings-page">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <h2 class="page-title">Paramètres du profil</h2>

    <div v-if="auth.profile" class="settings-form">
      <!-- Avatar -->
      <div class="avatar-section">
        <div class="avatar-preview" @click="triggerFileInput">
          <img v-if="avatarPreview" :src="avatarPreview" alt="Avatar" />
          <span v-else class="avatar-initial">
            {{ auth.profile.display_name.charAt(0).toUpperCase() }}
          </span>
          <div class="avatar-overlay">Changer</div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />
        <p class="avatar-hint">Clique sur la photo pour la changer</p>
      </div>

      <!-- Display name -->
      <div class="field">
        <label for="displayName">Nom affiché</label>
        <input
          id="displayName"
          v-model="displayName"
          type="text"
          placeholder="Ton nom"
          maxlength="50"
        />
      </div>

      <!-- Username -->
      <div class="field">
        <label for="username">Nom d'utilisateur (@)</label>
        <div class="input-with-prefix">
          <span class="prefix">@</span>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="ton_pseudo"
            maxlength="30"
            pattern="[a-zA-Z0-9_]+"
          />
        </div>
        <p class="field-hint">Lettres, chiffres et underscores uniquement</p>
      </div>

      <!-- Email (read-only) -->
      <div class="field">
        <label>Email</label>
        <input :value="auth.user?.email" type="email" disabled />
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <button class="save-btn" @click="save" :disabled="saving">
        {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const displayName = ref('')
const username = ref('')
const avatarPreview = ref(null)
const avatarFile = ref(null)
const fileInput = ref(null)
const saving = ref(false)
const error = ref('')
const success = ref('')

onMounted(() => {
  if (auth.profile) {
    displayName.value = auth.profile.display_name || ''
    username.value = auth.profile.username || ''
    avatarPreview.value = auth.profile.avatar_url || null
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    error.value = 'Image trop lourde (max 2 Mo)'
    return
  }
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function save() {
  error.value = ''
  success.value = ''

  if (!displayName.value.trim()) {
    error.value = 'Le nom affiché est requis'
    return
  }
  if (!username.value.trim()) {
    error.value = "Le nom d'utilisateur est requis"
    return
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username.value)) {
    error.value = "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores"
    return
  }

  saving.value = true
  try {
    if (avatarFile.value) {
      await auth.uploadAvatar(avatarFile.value)
      avatarFile.value = null
    }

    await auth.updateProfile({
      username: username.value.trim(),
      displayName: displayName.value.trim(),
    })

    success.value = 'Profil mis à jour !'
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      error.value = "Ce nom d'utilisateur est déjà pris"
    } else {
      error.value = e.message || 'Erreur lors de la sauvegarde'
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
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

.page-title {
  padding: 1rem;
  margin: 0;
  font-size: 1.2rem;
  border-bottom: 1px solid var(--border);
}

.settings-form {
  padding: 1.5rem 1rem;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 2rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initial {
  font-size: 2rem;
}

.avatar-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.7rem;
  text-align: center;
  padding: 4px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

.avatar-hint {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.hidden {
  display: none;
}

.field {
  margin-bottom: 1.25rem;
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

.field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-with-prefix {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  overflow: hidden;
}

.input-with-prefix .prefix {
  padding: 0.6rem 0 0.6rem 0.75rem;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.input-with-prefix input {
  border: none;
  border-radius: 0;
  padding-left: 0.25rem;
}

.input-with-prefix input:focus {
  border: none;
}

.field-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.error {
  color: var(--danger);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.success {
  color: var(--success);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.save-btn {
  width: 100%;
  padding: 0.7rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
