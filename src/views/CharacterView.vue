<template>
  <div class="character-page">
    <!-- Top bar -->
    <div class="character-top-bar">
      <button @click="$router.back()" class="back-btn">&larr;</button>
      <h1 class="top-bar-title">iCharacter</h1>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <div v-else-if="!profileData" class="loading">Profil introuvable.</div>

    <template v-else>
      <div class="character-content">
        <!-- Character Photo -->
        <div class="character-photo-section">
          <div class="character-photo-wrapper" @click="isOwnProfile && triggerPhotoUpload()">
            <img
              v-if="form.photo_url"
              :src="form.photo_url"
              alt="Photo du personnage"
              class="character-photo"
            />
            <div v-else class="character-photo-placeholder">
              <span>&#x1F9D9;</span>
            </div>
            <div v-if="isOwnProfile" class="photo-overlay">
              <span>&#x1F4F7;</span>
            </div>
          </div>
          <input
            ref="photoInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style="display:none"
            @change="handlePhotoUpload"
          />
          <ImageCropper
            v-if="showCropper"
            :src="cropperSrc"
            shape="square"
            title="Recadrer la photo du personnage"
            @cancel="showCropper = false"
            @crop="onPhotoCropped"
          />
          <div class="character-name-display">
            <h2>{{ form.prenom }} {{ form.nom }}</h2>
            <span class="character-username">@{{ profileData.username }}</span>
          </div>
        </div>

        <!-- Identity Fields -->
        <div class="character-section">
          <h3 class="section-title">Identit&eacute;</h3>
          <div class="fields-grid">
            <div class="field">
              <label>Pr&eacute;nom</label>
              <input v-if="isOwnProfile" v-model="form.prenom" type="text" maxlength="50" placeholder="Pr&eacute;nom" />
              <span v-else class="field-value">{{ form.prenom || '—' }}</span>
            </div>
            <div class="field">
              <label>Nom</label>
              <input v-if="isOwnProfile" v-model="form.nom" type="text" maxlength="50" placeholder="Nom" />
              <span v-else class="field-value">{{ form.nom || '—' }}</span>
            </div>
            <div class="field">
              <label>Nationalit&eacute;</label>
              <input v-if="isOwnProfile" v-model="form.nationalite" type="text" maxlength="50" placeholder="Nationalit&eacute;" />
              <span v-else class="field-value">{{ form.nationalite || '—' }}</span>
            </div>
            <div class="field">
              <label>Sexe</label>
              <select v-if="isOwnProfile" v-model="form.sexe">
                <option value="">—</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
                <option value="Autre">Autre</option>
              </select>
              <span v-else class="field-value">{{ form.sexe || '—' }}</span>
            </div>
            <div class="field">
              <label>Lieu de Naissance</label>
              <input v-if="isOwnProfile" v-model="form.lieu_naissance" type="text" maxlength="100" placeholder="Lieu de naissance" />
              <span v-else class="field-value">{{ form.lieu_naissance || '—' }}</span>
            </div>
            <div class="field">
              <label>Date de Naissance</label>
              <input v-if="isOwnProfile" v-model="form.date_naissance" type="date" />
              <span v-else class="field-value">{{ form.date_naissance || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Stats Section -->
        <div class="character-section">
          <h3 class="section-title">Comp&eacute;tences</h3>

          <!-- Radar Chart -->
          <div class="radar-container">
            <StatsRadarChart :stats="statValues" :size="280" />
          </div>

          <!-- Stat sliders (edit mode) -->
          <div v-if="isOwnProfile" class="stats-sliders">
            <div v-for="stat in statDefs" :key="stat.key" class="stat-slider">
              <label>
                <span class="stat-emoji">{{ stat.emoji }}</span>
                {{ stat.label }}
              </label>
              <div class="slider-row">
                <input
                  type="range"
                  min="0"
                  max="5"
                  v-model.number="form[stat.key]"
                />
                <span class="stat-num">{{ form[stat.key] }}</span>
              </div>
            </div>
          </div>

          <!-- Stat bars (view mode) -->
          <div v-else class="stats-bars">
            <div v-for="stat in statDefs" :key="stat.key" class="stat-bar-item">
              <span class="stat-bar-label">
                <span class="stat-emoji">{{ stat.emoji }}</span>
                {{ stat.label }}
              </span>
              <div class="stat-bar-track">
                <div class="stat-bar-fill" :style="{ width: ((form[stat.key] || 0) / 5 * 100) + '%' }"></div>
              </div>
              <span class="stat-bar-value">{{ form[stat.key] || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Inventory Section -->
        <div class="character-section">
          <h3 class="section-title">
            Inventaire
            <span v-if="inventory.length > 0" class="inv-badge">{{ inventory.length }}</span>
          </h3>

          <div v-if="loadingInventory" class="loading">Chargement...</div>
          <div v-else-if="inventory.length === 0 && !isOwnProfile" class="empty-inv">Inventaire vide</div>
          <div v-else-if="inventory.length > 0 || isOwnProfile" class="inv-grid">
            <div
              v-for="item in inventory"
              :key="item.id"
              class="inv-card"
              :title="item.description || item.name"
            >
              <img v-if="item.image_url" :src="item.image_url" alt="" class="inv-img" />
              <span v-else class="inv-icon">{{ item.icon }}</span>
              <span class="inv-name">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="inv-qty">x{{ item.quantity }}</span>
              <button v-if="isOwnProfile" class="inv-remove" @click="removeItem(item.id)" title="Supprimer">&#x2715;</button>
            </div>
            <button v-if="isOwnProfile" class="inv-add-card" @click="showAddModal = true">
              <span class="inv-add-plus">+</span>
              <span class="inv-add-label">Ajouter</span>
            </button>
          </div>
        </div>

        <!-- Add Item Modal -->
        <Teleport to="body">
          <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
            <div class="modal-box" @click.stop>
              <h3 class="modal-title">Nouvel objet</h3>
              <div class="modal-field">
                <label>Visuel</label>
                <div class="inv-visual-toggle">
                  <button :class="{ active: !newItemUseImage }" @click="newItemUseImage = false">Emoji</button>
                  <button :class="{ active: newItemUseImage }" @click="newItemUseImage = true">Image</button>
                </div>
              </div>
              <div v-if="!newItemUseImage" class="modal-field">
                <div class="emoji-grid">
                  <button
                    v-for="e in emojiOptions"
                    :key="e"
                    class="emoji-btn"
                    :class="{ selected: newItem.icon === e }"
                    @click="newItem.icon = e"
                  >{{ e }}</button>
                </div>
              </div>
              <div v-else class="modal-field">
                <div v-if="newItemImagePreview" class="inv-img-preview-wrap">
                  <img :src="newItemImagePreview" alt="" class="inv-img-preview" />
                  <button class="inv-img-remove" @click="removeItemImage">&times;</button>
                </div>
                <button v-else class="inv-img-upload-btn" @click="itemImageInput?.click()">
                  + Choisir une image
                </button>
                <input ref="itemImageInput" type="file" accept="image/*" style="display:none" @change="onItemImageChange" />
              </div>
              <div class="modal-field">
                <label>Nom</label>
                <input v-model="newItem.name" type="text" maxlength="50" placeholder="Nom de l'objet" />
              </div>
              <div class="modal-field">
                <label>Description (optionnel)</label>
                <input v-model="newItem.description" type="text" maxlength="200" placeholder="Description courte" />
              </div>
              <div class="modal-field">
                <label>Quantit&eacute;</label>
                <div class="qty-control">
                  <button @click="newItem.quantity = Math.max(1, newItem.quantity - 1)">-</button>
                  <span>{{ newItem.quantity }}</span>
                  <button @click="newItem.quantity++">+</button>
                </div>
              </div>
              <p v-if="addError" class="modal-error">{{ addError }}</p>
              <div class="modal-actions">
                <button class="modal-cancel" @click="showAddModal = false">Annuler</button>
                <button class="modal-save" @click="addItem" :disabled="addingItem">
                  {{ addingItem ? '...' : 'Ajouter' }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>

        <!-- Save button -->
        <div v-if="isOwnProfile" class="save-section">
          <button class="save-btn" :disabled="saving" @click="saveSheet">
            {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
          </button>
          <span v-if="saveMsg" class="save-msg" :class="saveMsgType">{{ saveMsg }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCharacterStore } from '../stores/character'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/imageCompress'
import StatsRadarChart from '../components/StatsRadarChart.vue'
import ImageCropper from '../components/ImageCropper.vue'

const route = useRoute()
const auth = useAuthStore()
const characterStore = useCharacterStore()

const profileData = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveMsg = ref('')
const saveMsgType = ref('')
const photoInput = ref(null)
const showCropper = ref(false)
const cropperSrc = ref('')

const form = ref({
  photo_url: '',
  nom: '',
  prenom: '',
  nationalite: '',
  sexe: '',
  lieu_naissance: '',
  date_naissance: '',
  charisme: 0,
  intelligence: 0,
  force: 0,
  vigueur: 0,
  mobilite: 0,
})

const statDefs = [
  { key: 'charisme', label: 'Charisme', emoji: '✨' },
  { key: 'intelligence', label: 'Intelligence', emoji: '🧠' },
  { key: 'force', label: 'Force', emoji: '💪' },
  { key: 'vigueur', label: 'Vigueur', emoji: '🛡️' },
  { key: 'mobilite', label: 'Mobilité', emoji: '🏃' },
]

const statValues = computed(() => ({
  charisme: form.value.charisme,
  intelligence: form.value.intelligence,
  force: form.value.force,
  vigueur: form.value.vigueur,
  mobilite: form.value.mobilite,
}))

// Inventory
const inventory = ref([])
const loadingInventory = ref(false)
const showAddModal = ref(false)
const addingItem = ref(false)
const addError = ref('')
const newItem = reactive({ name: '', description: '', icon: '📦', quantity: 1 })
const newItemUseImage = ref(false)
const newItemImage = ref(null)
const newItemImagePreview = ref(null)
const itemImageInput = ref(null)

function onItemImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  newItemImage.value = file
  newItemImagePreview.value = URL.createObjectURL(file)
}
function removeItemImage() {
  newItemImage.value = null
  newItemImagePreview.value = null
  if (itemImageInput.value) itemImageInput.value.value = ''
}

const emojiOptions = [
  '⚔️', '🗡️', '🏹', '🔫', '💣', '🛡️', '🪖', '👑',
  '💍', '📿', '🧪', '🧬', '💎', '🔮', '📜', '🗝️',
  '🎒', '📦', '🧰', '🎭', '🧲', '⚡', '🔥', '❄️',
  '🌟', '💰', '🍖', '🧃', '🏆', '🎯', '🛸', '🐉',
]

async function fetchInventory(profileId) {
  loadingInventory.value = true
  try {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
    inventory.value = data || []
  } catch { /* silent */ } finally {
    loadingInventory.value = false
  }
}

async function addItem() {
  addError.value = ''
  if (!newItem.name.trim()) { addError.value = 'Le nom est requis'; return }
  addingItem.value = true
  try {
    let imageUrl = null
    if (newItemUseImage.value && newItemImage.value) {
      const file = newItemImage.value
      const compressed = await compressImage(file)
      const ext = (compressed.name || file.name).split('.').pop()
      const fileName = `${profileData.value.id}/item_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('inventory-images')
        .upload(fileName, compressed, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage
        .from('inventory-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        profile_id: profileData.value.id,
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        icon: newItem.icon,
        quantity: newItem.quantity,
        image_url: imageUrl,
      })
      .select()
      .single()
    if (error) throw error
    inventory.value.push(data)
    showAddModal.value = false
    newItem.name = ''; newItem.description = ''; newItem.icon = '📦'; newItem.quantity = 1
    newItemUseImage.value = false
    removeItemImage()
  } catch (e) {
    addError.value = e.message || 'Erreur'
  } finally {
    addingItem.value = false
  }
}

async function removeItem(itemId) {
  await supabase.from('inventory_items').delete().eq('id', itemId)
  inventory.value = inventory.value.filter(i => i.id !== itemId)
}

const isOwnProfile = computed(() => {
  if (!profileData.value || !auth.profiles) return false
  return auth.profiles.some(p => p.id === profileData.value.id)
})

async function loadProfile(username) {
  loading.value = true
  saveMsg.value = ''
  inventory.value = []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()
    if (error) throw error
    profileData.value = data

    fetchInventory(data.id)
    const sheet = await characterStore.fetchSheet(data.id)
    if (sheet) {
      form.value = {
        photo_url: sheet.photo_url || '',
        nom: sheet.nom || '',
        prenom: sheet.prenom || '',
        nationalite: sheet.nationalite || '',
        sexe: sheet.sexe || '',
        lieu_naissance: sheet.lieu_naissance || '',
        date_naissance: sheet.date_naissance || '',
        charisme: sheet.charisme || 0,
        intelligence: sheet.intelligence || 0,
        force: sheet.force || 0,
        vigueur: sheet.vigueur || 0,
        mobilite: sheet.mobilite || 0,
      }
    } else {
      // Reset form for new sheet
      form.value = {
        photo_url: '', nom: '', prenom: '', nationalite: '', sexe: '',
        lieu_naissance: '', date_naissance: '',
        charisme: 0, intelligence: 0, force: 0, vigueur: 0, mobilite: 0,
      }
    }
  } catch {
    profileData.value = null
  } finally {
    loading.value = false
  }
}

function triggerPhotoUpload() {
  photoInput.value?.click()
}

function handlePhotoUpload(e) {
  const file = e.target.files?.[0]
  if (!file || !profileData.value) return
  if (file.size > 5 * 1024 * 1024) {
    saveMsg.value = 'Image trop lourde (max 5 Mo)'
    saveMsgType.value = 'error'
    e.target.value = ''
    return
  }
  cropperSrc.value = URL.createObjectURL(file)
  showCropper.value = true
  e.target.value = ''
}

async function onPhotoCropped(file) {
  if (!profileData.value) return
  showCropper.value = false
  try {
    const url = await characterStore.uploadCharacterPhoto(profileData.value.id, file)
    form.value.photo_url = url
    await characterStore.upsertSheet(profileData.value.id, { ...form.value })
    saveMsg.value = 'Photo mise à jour !'
    saveMsgType.value = 'success'
    setTimeout(() => { saveMsg.value = '' }, 3000)
  } catch (err) {
    saveMsg.value = err.message
    saveMsgType.value = 'error'
  }
}

async function saveSheet() {
  if (!profileData.value) return
  saving.value = true
  saveMsg.value = ''
  try {
    await characterStore.upsertSheet(profileData.value.id, { ...form.value })
    saveMsg.value = 'Fiche sauvegardée !'
    saveMsgType.value = 'success'
  } catch (err) {
    saveMsg.value = err.message || 'Erreur lors de la sauvegarde.'
    saveMsgType.value = 'error'
  } finally {
    saving.value = false
    setTimeout(() => { saveMsg.value = '' }, 3000)
  }
}

watch(() => route.params.username, (username) => {
  if (username) loadProfile(username)
})

onMounted(() => {
  if (route.params.username) loadProfile(route.params.username)
})
</script>

<style scoped src="./CharacterView.css"></style>
