<template>
  <div class="settings-page">
    <div class="back-bar">
      <button @click="$router.back()" class="back-btn">&larr; Retour</button>
    </div>

    <h2 class="page-title">Paramètres</h2>

    <!-- Profile selector -->
    <div class="section">
      <h3 class="section-title">Mes profils</h3>
      <div
        v-for="p in auth.profiles"
        :key="p.id"
        class="profile-item"
        :class="{ active: p.id === editingProfileId }"
        @click="startEditing(p)"
      >
        <UserAvatar :url="p.avatar_url" :name="p.display_name" :size="36" />
        <div class="profile-item-info">
          <span class="profile-item-name">{{ p.display_name }}</span>
          <span class="profile-item-handle">@{{ p.username }}</span>
        </div>
        <span v-if="p.id === auth.activeProfile?.id" class="active-badge">Actif</span>
      </div>

      <button class="add-profile-btn" @click="showNewProfile = true" v-if="!showNewProfile">
        + Créer un nouveau profil
      </button>

      <!-- New profile form -->
      <div v-if="showNewProfile" class="new-profile-form">
        <h4>Nouveau profil</h4>
        <div class="field">
          <label>Nom d'utilisateur (@)</label>
          <input v-model="newUsername" type="text" placeholder="nouveau_pseudo" maxlength="30" />
        </div>
        <div class="field">
          <label>Nom affiché</label>
          <input v-model="newDisplayName" type="text" placeholder="Nom affiché" maxlength="50" />
        </div>
        <p v-if="newError" class="error">{{ newError }}</p>
        <div class="form-actions">
          <button class="save-btn small" @click="handleCreateProfile" :disabled="creatingProfile">
            {{ creatingProfile ? '...' : 'Créer' }}
          </button>
          <button class="cancel-btn" @click="showNewProfile = false">Annuler</button>
        </div>
      </div>
    </div>

    <!-- Edit selected profile -->
    <div v-if="editingProfile" class="section">
      <h3 class="section-title">Modifier : {{ editingProfile.display_name }}</h3>

      <!-- Avatar -->
      <div class="avatar-section">
        <div class="avatar-preview" @click="triggerFileInput">
          <img v-if="avatarPreview" :src="avatarPreview" alt="Avatar" />
          <span v-else class="avatar-initial">
            {{ editingProfile.display_name.charAt(0).toUpperCase() }}
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
      </div>

      <!-- Image Cropper -->
      <ImageCropper
        v-if="showCropper"
        :src="cropperSrc"
        @cancel="showCropper = false"
        @crop="onCropped"
      />

      <!-- Display name -->
      <div class="field">
        <label>Nom affiché</label>
        <input v-model="editDisplayName" type="text" maxlength="50" />
      </div>

      <!-- Username -->
      <div class="field">
        <label>Nom d'utilisateur (@)</label>
        <div class="input-with-prefix">
          <span class="prefix">@</span>
          <input v-model="editUsername" type="text" maxlength="30" />
        </div>
      </div>

      <!-- Bio -->
      <div class="field">
        <label>Bio</label>
        <textarea
          v-model="editBio"
          class="bio-input"
          maxlength="160"
          rows="3"
          placeholder="Décrivez-vous en quelques mots..."
        ></textarea>
        <span class="char-count">{{ editBio.length }}/160</span>
      </div>

      <!-- Hero color customization -->
      <div v-if="editingProfile?.is_hero" class="hero-colors-section">
        <h4 class="hero-colors-title">Personnalisation Hero</h4>
        <p class="hero-colors-desc">Choisis les couleurs de tes posts Hero</p>

        <div class="color-fields">
          <div class="color-field">
            <label>Couleur primaire</label>
            <div class="color-input-row">
              <input type="color" v-model="editHeroColorPrimary" class="color-picker" />
              <input type="text" v-model="editHeroColorPrimary" class="color-text" maxlength="7" placeholder="#FFD700" />
            </div>
          </div>
          <div class="color-field">
            <label>Couleur secondaire</label>
            <div class="color-input-row">
              <input type="color" v-model="editHeroColorSecondary" class="color-picker" />
              <input type="text" v-model="editHeroColorSecondary" class="color-text" maxlength="7" placeholder="#FF6B00" />
            </div>
          </div>
        </div>

        <!-- Live preview -->
        <div class="hero-preview" :style="{ '--hero-primary': editHeroColorPrimary, '--hero-secondary': editHeroColorSecondary, '--hero-glow': editHeroColorPrimary + '40' }">
          <div class="hero-preview-header">
            <span class="hero-preview-name" :style="{ background: `linear-gradient(90deg, ${editHeroColorPrimary}, ${editHeroColorSecondary})`, '-webkit-background-clip': 'text', '-webkit-text-fill-color': 'transparent', 'background-clip': 'text' }">{{ editDisplayName || 'Apercu' }}</span>
            <span class="hero-preview-handle">@{{ editUsername || 'hero' }}</span>
          </div>
          <p class="hero-preview-text">Voici un apercu de vos posts Hero !</p>
        </div>
      </div>

      <!-- Email (read-only) -->
      <div class="field">
        <label>Email (compte)</label>
        <input :value="auth.user?.email" type="email" disabled />
      </div>

      <p v-if="editError" class="error">{{ editError }}</p>
      <p v-if="editSuccess" class="success">{{ editSuccess }}</p>

      <div class="form-actions">
        <button class="save-btn" @click="handleSave" :disabled="saving">
          {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
        <button
          v-if="auth.profiles.length > 1"
          class="delete-profile-btn"
          @click="handleDeleteProfile"
        >
          Supprimer ce profil
        </button>
      </div>
    </div>

    <!-- App preferences -->
    <div class="section">
      <h3 class="section-title">Préférences</h3>

      <div class="pref-row">
        <div class="pref-info">
          <span class="pref-label">Widget Messages</span>
          <span class="pref-desc">Afficher le widget flottant de messages en bas &agrave; droite</span>
        </div>
        <button
          class="toggle-switch"
          :class="{ on: dmWidgetEnabled }"
          @click="toggleDmWidget"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="pref-row">
        <div class="pref-info">
          <span class="pref-label">Solde iBank</span>
          <span class="pref-desc">Afficher votre solde iBank sur votre profil public</span>
        </div>
        <button
          class="toggle-switch"
          :class="{ on: showBalanceEnabled }"
          @click="toggleShowBalance"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import UserAvatar from '../components/UserAvatar.vue'
import ImageCropper from '../components/ImageCropper.vue'

const auth = useAuthStore()

const editingProfileId = ref(null)
const editingProfile = ref(null)
const editDisplayName = ref('')
const editUsername = ref('')
const editBio = ref('')
const avatarPreview = ref(null)
const avatarFile = ref(null)
const fileInput = ref(null)
const saving = ref(false)
const editError = ref('')
const editSuccess = ref('')

const editHeroColorPrimary = ref('#FFD700')
const editHeroColorSecondary = ref('#FF6B00')

const showCropper = ref(false)
const cropperSrc = ref('')

const showNewProfile = ref(false)
const newUsername = ref('')
const newDisplayName = ref('')
const newError = ref('')
const creatingProfile = ref(false)

const dmWidgetEnabled = ref(localStorage.getItem('dmWidgetEnabled') !== 'false')
const showBalanceEnabled = ref(false)

function toggleDmWidget() {
  dmWidgetEnabled.value = !dmWidgetEnabled.value
  localStorage.setItem('dmWidgetEnabled', dmWidgetEnabled.value)
  // Dispatch event so App.vue can react
  window.dispatchEvent(new CustomEvent('dm-widget-toggle', { detail: dmWidgetEnabled.value }))
}

async function toggleShowBalance() {
  if (!auth.activeProfile) return
  showBalanceEnabled.value = !showBalanceEnabled.value
  try {
    await auth.updateProfile(auth.activeProfile.id, { showBalance: showBalanceEnabled.value })
  } catch {
    showBalanceEnabled.value = !showBalanceEnabled.value
  }
}

onMounted(() => {
  if (auth.activeProfile) {
    startEditing(auth.activeProfile)
    showBalanceEnabled.value = !!auth.activeProfile.show_balance
  }
})

function startEditing(p) {
  editingProfileId.value = p.id
  editingProfile.value = p
  editDisplayName.value = p.display_name || ''
  editUsername.value = p.username || ''
  editBio.value = p.bio || ''
  avatarPreview.value = p.avatar_url || null
  avatarFile.value = null
  editHeroColorPrimary.value = p.hero_color_primary || '#FFD700'
  editHeroColorSecondary.value = p.hero_color_secondary || '#FF6B00'
  editError.value = ''
  editSuccess.value = ''
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    editError.value = 'Image trop lourde (max 5 Mo)'
    return
  }
  cropperSrc.value = URL.createObjectURL(file)
  showCropper.value = true
  // Reset file input so same file can be re-selected
  e.target.value = ''
}

function onCropped(file, previewUrl) {
  avatarFile.value = file
  avatarPreview.value = previewUrl
  showCropper.value = false
}

async function handleSave() {
  editError.value = ''
  editSuccess.value = ''

  if (!editDisplayName.value.trim()) {
    editError.value = 'Le nom affiché est requis'
    return
  }
  if (!editUsername.value.trim()) {
    editError.value = "Le nom d'utilisateur est requis"
    return
  }
  if (!/^[a-zA-Z0-9_]+$/.test(editUsername.value)) {
    editError.value = "Lettres, chiffres et underscores uniquement"
    return
  }
  if (editUsername.value.trim().length < 3 || editUsername.value.trim().length > 30) {
    editError.value = "Le nom d'utilisateur doit faire entre 3 et 30 caractères"
    return
  }
  if (editDisplayName.value.trim().length > 50) {
    editError.value = "Le nom affiché ne doit pas dépasser 50 caractères"
    return
  }
  if (editBio.value.length > 160) {
    editError.value = "La bio ne doit pas dépasser 160 caractères"
    return
  }

  saving.value = true
  try {
    if (avatarFile.value) {
      await auth.uploadAvatar(editingProfileId.value, avatarFile.value)
      avatarFile.value = null
    }

    const profileUpdate = {
      username: editUsername.value.trim(),
      displayName: editDisplayName.value.trim(),
      bio: editBio.value.trim(),
    }
    if (editingProfile.value?.is_hero) {
      profileUpdate.heroColorPrimary = editHeroColorPrimary.value
      profileUpdate.heroColorSecondary = editHeroColorSecondary.value
    }
    const updated = await auth.updateProfile(editingProfileId.value, profileUpdate)

    editingProfile.value = updated
    editSuccess.value = 'Profil mis à jour !'
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      editError.value = "Ce nom d'utilisateur est déjà pris"
    } else {
      editError.value = e.message || 'Erreur lors de la sauvegarde'
    }
  } finally {
    saving.value = false
  }
}

async function handleCreateProfile() {
  newError.value = ''
  if (!newUsername.value.trim()) {
    newError.value = "Le nom d'utilisateur est requis"
    return
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername.value)) {
    newError.value = "Lettres, chiffres et underscores uniquement"
    return
  }
  if (newUsername.value.trim().length < 3 || newUsername.value.trim().length > 30) {
    newError.value = "Le nom d'utilisateur doit faire entre 3 et 30 caractères"
    return
  }

  creatingProfile.value = true
  try {
    const created = await auth.createProfile(newUsername.value.trim(), newDisplayName.value.trim())
    showNewProfile.value = false
    newUsername.value = ''
    newDisplayName.value = ''
    startEditing(created)
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      newError.value = "Ce nom d'utilisateur est déjà pris"
    } else {
      newError.value = e.message || 'Erreur'
    }
  } finally {
    creatingProfile.value = false
  }
}

async function handleDeleteProfile() {
  if (!confirm(`Supprimer le profil @${editingProfile.value.username} ? Tous ses posts seront supprimés.`)) return
  try {
    await auth.deleteProfile(editingProfileId.value)
    if (auth.profiles.length > 0) {
      startEditing(auth.profiles[0])
    } else {
      editingProfile.value = null
      editingProfileId.value = null
    }
  } catch (e) {
    editError.value = e.message
  }
}
</script>

<style scoped src="./SettingsView.css"></style>
