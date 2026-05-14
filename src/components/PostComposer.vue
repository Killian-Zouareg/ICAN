<template>
  <div class="composer">
    <MentionInput
      v-model="content"
      tag="textarea"
      placeholder="Quoi de neuf ?"
      maxlength="500"
      rows="3"
      @keydown.ctrl.enter="submit"
    />

    <!-- Image preview -->
    <div v-if="imagePreview" class="image-preview">
      <img :src="imagePreview" alt="Preview" />
      <button class="remove-image" @click="removeImage">&times;</button>
    </div>

    <div class="composer-footer">
      <div class="footer-left">
        <button class="icon-btn" @click="triggerFileInput" title="Ajouter une image">
          <span class="img-icon">&#x1F5BC;</span>
        </button>
        <button
          class="icon-btn live-loc-btn"
          :class="{ active: !!pendingShare }"
          @click="openShareModal"
          :title="pendingShare ? `Partage actif (${pendingShareLabel})` : 'Partager ma position en direct'"
        >
          <span class="img-icon">&#x1F4CD;</span>
        </button>
        <button
          class="icon-btn drafts-btn"
          @click="openDrafts"
          :title="`Brouillons (${draftsCount})`"
        >
          <span class="drafts-icon">&#x1F4CB;</span>
          <span v-if="draftsCount > 0" class="drafts-badge">{{ draftsCount }}</span>
        </button>
        <span class="char-count" :class="{ warn: content.length > 450 }">
          {{ content.length }}/500
        </span>
      </div>
      <button class="publish-btn" @click="submit" :disabled="(!content.trim() && !imageFile) || submitting">
        {{ submitting ? '...' : 'Publier' }}
      </button>
    </div>

    <!-- Pending live location chip -->
    <div v-if="pendingShare" class="live-loc-pending" @click.stop>
      <span class="live-loc-pending-icon">&#x1F4CD;</span>
      <span class="live-loc-pending-text">
        Position en direct · <strong>{{ pendingShareLabel }}</strong>
      </span>
      <button class="live-loc-pending-remove" @click="pendingShare = null" title="Annuler">&times;</button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      style="display: none"
      @change="handleFileChange"
    />

    <!-- Live location share modal -->
    <div v-if="showShareModal" class="drafts-overlay" @click.self="showShareModal = false">
      <div class="drafts-modal live-loc-modal">
        <div class="drafts-header">
          <h3>Partager ma position en direct</h3>
          <button class="close-modal" @click="showShareModal = false">&times;</button>
        </div>
        <div v-if="!tokenStore.myToken" class="live-loc-empty">
          <p>Tu n'as pas encore placé ton token sur la carte.</p>
          <router-link to="/map" class="live-loc-go-map">Placer mon token sur la carte &rarr;</router-link>
        </div>
        <template v-else>
          <p class="live-loc-coords">
            Token actuel : <strong>{{ tokenStore.myToken.lat.toFixed(4) }}, {{ tokenStore.myToken.lng.toFixed(4) }}</strong>
          </p>
          <p class="live-loc-help">
            La position sera visible par tous les utilisateurs pendant la durée choisie. Tu peux déplacer ton token sur la carte à tout moment ; les viewers verront le déplacement en direct.
          </p>
          <div class="live-loc-duration-grid">
            <button
              v-for="d in SHARE_DURATIONS"
              :key="d.minutes"
              class="live-loc-duration-btn"
              :class="{ active: selectedDuration === d.minutes }"
              @click="selectedDuration = d.minutes"
            >
              {{ d.label }}
            </button>
          </div>
          <div class="form-actions">
            <button class="form-cancel" @click="showShareModal = false">Annuler</button>
            <button class="form-save" @click="confirmShare">Activer le partage</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Drafts modal -->
    <div v-if="showDrafts" class="drafts-overlay" @click.self="closeDrafts">
      <div class="drafts-modal">
        <div class="drafts-header">
          <h3>Brouillons</h3>
          <button class="close-modal" @click="closeDrafts">&times;</button>
        </div>

        <div class="drafts-save-form">
          <input
            v-model="newDraftName"
            type="text"
            class="draft-name-input"
            placeholder="Nom du brouillon (optionnel)"
            maxlength="60"
          />
          <button
            class="save-form-btn"
            :disabled="(!content.trim() && !imageFile) || saving"
            @click="saveCurrentDraft"
          >
            {{ saving ? '...' : 'Sauvegarder le brouillon' }}
          </button>
        </div>
        <div v-if="imageFile" class="drafts-current-image">
          <img :src="imagePreview" alt="Image courante" />
          <span>L'image actuelle sera incluse dans le brouillon.</span>
        </div>

        <div v-if="drafts.length === 0" class="drafts-empty">
          Aucun brouillon enregistré.
        </div>
        <ul v-else class="drafts-list">
          <li v-for="d in drafts" :key="d.id" class="draft-item">
            <img v-if="d.image?.dataURL" :src="d.image.dataURL" alt="" class="draft-thumb" />
            <div class="draft-info" @click="loadDraft(d)">
              <div class="draft-name">{{ d.name || '(Sans nom)' }}</div>
              <div class="draft-preview">{{ truncate(d.content, 120) }}</div>
              <div class="draft-meta">{{ formatDate(d.updatedAt) }}</div>
            </div>
            <div class="draft-actions">
              <button class="draft-action" @click.stop="loadDraft(d)" title="Charger">
                &#x21A9;
              </button>
              <button class="draft-action" @click.stop="renameDraftPrompt(d)" title="Renommer">
                &#x270F;
              </button>
              <button class="draft-action danger" @click.stop="removeDraft(d)" title="Supprimer">
                &times;
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePostsStore } from '../stores/posts'
import { useMapLocationsStore } from '../stores/mapLocations'
import { useAuthStore } from '../stores/auth'
import { useUserTokenStore, SHARE_DURATIONS } from '../stores/userToken'
import { extractLocationIds } from '../lib/locationMentions'
import { listDrafts, saveDraft, deleteDraft, renameDraft } from '../lib/drafts'
import MentionInput from './MentionInput.vue'

const props = defineProps({
  prefill: { type: String, default: '' },
})

const postsStore = usePostsStore()
const mapStore = useMapLocationsStore()
const auth = useAuthStore()
const tokenStore = useUserTokenStore()

const showShareModal = ref(false)
const selectedDuration = ref(SHARE_DURATIONS[0].minutes)
// pendingShare = { durationMinutes }
const pendingShare = ref(null)

const pendingShareLabel = computed(() => {
  const d = pendingShare.value
  if (!d) return ''
  const match = SHARE_DURATIONS.find((x) => x.minutes === d.durationMinutes)
  return match ? match.label : `${d.durationMinutes} min`
})

function openShareModal() {
  if (pendingShare.value) {
    if (confirm('Retirer le partage de position de ce post ?')) pendingShare.value = null
    return
  }
  tokenStore.fetchMyToken()
  selectedDuration.value = SHARE_DURATIONS[0].minutes
  showShareModal.value = true
}

function confirmShare() {
  if (!tokenStore.myToken) return
  pendingShare.value = { durationMinutes: selectedDuration.value }
  showShareModal.value = false
}
const content = ref('')
const submitting = ref(false)
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

const showDrafts = ref(false)
const drafts = ref([])
const newDraftName = ref('')
const saving = ref(false)

const draftsCount = computed(() => drafts.value.length)

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Resize + recompress to keep draft images well under localStorage quota.
async function compressImageForDraft(file, maxDim = 1280, quality = 0.82) {
  const isGif = file.type === 'image/gif'
  // GIFs lose animation if drawn to canvas; keep small ones as-is, skip big ones.
  if (isGif) {
    if (file.size > 800 * 1024) {
      throw new Error('GIF trop lourd pour brouillon (max 800 Ko)')
    }
    return await fileToDataURL(file)
  }
  const dataURL = await fileToDataURL(file)
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataURL
  })
  let { width, height } = img
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp'
  const outType = hasAlpha ? 'image/webp' : 'image/jpeg'
  return canvas.toDataURL(outType, quality)
}

async function dataURLToFile(dataURL, filename = 'draft-image') {
  const res = await fetch(dataURL)
  const blob = await res.blob()
  const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  return new File([blob], `${filename}.${ext}`, { type: blob.type })
}

function profileId() {
  return auth.activeProfile?.id || null
}

function refreshDrafts() {
  drafts.value = listDrafts(profileId())
}
refreshDrafts()

watch(
  () => props.prefill,
  (val) => {
    if (!val) return
    const prefix = val.endsWith('\n') ? val : val + '\n'
    content.value = content.value ? `${prefix}${content.value}` : prefix
  },
  { immediate: true },
)

function openDrafts() {
  refreshDrafts()
  newDraftName.value = ''
  showDrafts.value = true
}

function closeDrafts() {
  showDrafts.value = false
}

async function saveCurrentDraft() {
  if (!content.value.trim() && !imageFile.value) return
  saving.value = true
  try {
    let image = null
    if (imageFile.value) {
      try {
        const dataURL = await compressImageForDraft(imageFile.value)
        image = {
          dataURL,
          name: imageFile.value.name,
          type: imageFile.value.type,
        }
      } catch (err) {
        alert(err?.message || "Impossible de préparer l'image — brouillon sauvegardé sans elle.")
      }
    }
    try {
      saveDraft(profileId(), { name: newDraftName.value, content: content.value, image })
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
        alert("Stockage local plein — l'image est peut-être trop grosse pour être sauvegardée.")
      } else {
        throw e
      }
    }
    newDraftName.value = ''
    refreshDrafts()
  } finally {
    saving.value = false
  }
}

async function loadDraft(d) {
  content.value = d.content || ''
  removeImage()
  if (d.image?.dataURL) {
    try {
      imageFile.value = await dataURLToFile(d.image.dataURL, 'draft-image')
      imagePreview.value = d.image.dataURL
    } catch {
      // ignore — keep text only
    }
  }
  closeDrafts()
}

function removeDraft(d) {
  if (!confirm('Supprimer ce brouillon ?')) return
  deleteDraft(profileId(), d.id)
  refreshDrafts()
}

function renameDraftPrompt(d) {
  const name = prompt('Nouveau nom du brouillon :', d.name || '')
  if (name === null) return
  renameDraft(profileId(), d.id, name)
  refreshDrafts()
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }

  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  // Reset input so same file can be re-selected
  e.target.value = ''
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = null
}

async function submit() {
  if (!content.value.trim() && !imageFile.value && !pendingShare.value) return
  submitting.value = true
  let createdShareId = null
  try {
    const locationIds = extractLocationIds(content.value, mapStore.locations)
    if (pendingShare.value) {
      if (!tokenStore.myToken) throw new Error('Place ton token sur la carte avant de partager ta position.')
      const share = await tokenStore.createShare({
        durationMinutes: pendingShare.value.durationMinutes,
        target: { type: 'post' },
      })
      createdShareId = share.id
    }
    await postsStore.createPost(content.value.trim(), imageFile.value, locationIds, createdShareId)
    content.value = ''
    removeImage()
    pendingShare.value = null
  } catch (e) {
    // Rollback share if post creation failed
    if (createdShareId) {
      try { await tokenStore.stopShare(createdShareId) } catch (_) {}
    }
    alert(e.message || 'Erreur lors de la publication')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped src="./PostComposer.css"></style>
