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

onMounted(() => {
  if (auth.activeProfile) {
    startEditing(auth.activeProfile)
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

<style scoped>
.settings-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - var(--header-height));
  padding-bottom: var(--page-bottom-padding);
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

.section {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--text-secondary);
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 0.25rem;
}

.profile-item:hover {
  background: var(--bg-hover);
}

.profile-item.active {
  background: var(--bg-hover);
  border: 1px solid var(--accent);
}

.profile-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.profile-item-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.profile-item-handle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.active-badge {
  font-size: 0.7rem;
  background: var(--accent);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.add-profile-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.6rem;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
}

.add-profile-btn:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.new-profile-form {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
}

.new-profile-form h4 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.25rem;
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

.hidden {
  display: none;
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

.field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bio-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  box-sizing: border-box;
  resize: vertical;
  min-height: 60px;
  line-height: 1.4;
  outline: none;
}

.bio-input:focus {
  border-color: var(--accent);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
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
}

.input-with-prefix input {
  border: none;
  border-radius: 0;
  padding-left: 0.25rem;
}

.error {
  color: var(--danger);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.success {
  color: var(--success);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.save-btn {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 0.95rem;
  cursor: pointer;
}

.save-btn.small {
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.delete-profile-btn {
  background: none;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.delete-profile-btn:hover {
  background: var(--danger);
  color: white;
}

/* Hero color customization */
.hero-colors-section {
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.hero-colors-title {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
  background: linear-gradient(90deg, #FFD700, #FF6B00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-colors-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.color-fields {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.color-field {
  flex: 1;
}

.color-field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.color-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker {
  width: 40px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  padding: 2px;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-text {
  flex: 1;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-family: monospace;
}

.color-text:focus {
  outline: none;
  border-color: var(--accent);
}

/* Hero live preview */
.hero-preview {
  position: relative;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--hero-primary) 8%, var(--bg-primary)),
    color-mix(in srgb, var(--hero-secondary) 5%, var(--bg-primary))
  );
  box-shadow: 0 0 12px var(--hero-glow), inset 0 0 12px color-mix(in srgb, var(--hero-glow) 40%, transparent);
  overflow: hidden;
}

.hero-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 2px;
  background: linear-gradient(135deg, var(--hero-primary), var(--hero-secondary), var(--hero-primary));
  background-size: 200% 200%;
  animation: hero-gradient-shift 3s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.hero-preview-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.hero-preview-name {
  font-weight: 800;
  font-size: 0.9rem;
}

.hero-preview-handle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.hero-preview-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary);
}
</style>
