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
import StatsRadarChart from '../components/StatsRadarChart.vue'

const route = useRoute()
const auth = useAuthStore()
const characterStore = useCharacterStore()

const profileData = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveMsg = ref('')
const saveMsgType = ref('')
const photoInput = ref(null)

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
      const ext = file.name.split('.').pop()
      const fileName = `${profileData.value.id}/item_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('inventory-images')
        .upload(fileName, file, { upsert: true })
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

async function handlePhotoUpload(e) {
  const file = e.target.files?.[0]
  if (!file || !profileData.value) return
  try {
    const url = await characterStore.uploadCharacterPhoto(profileData.value.id, file)
    form.value.photo_url = url
  } catch (err) {
    saveMsg.value = err.message
    saveMsgType.value = 'error'
  }
  e.target.value = ''
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

<style scoped>
.character-page {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

.character-top-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 10;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 50%;
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--bg-hover);
}

.top-bar-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.loading {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.character-content {
  padding: 1rem;
}

/* Photo Section */
.character-photo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.character-photo-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 16px;
  overflow: hidden;
  border: 3px solid var(--border);
  cursor: pointer;
}

.character-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  font-size: 3rem;
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.character-photo-wrapper:hover .photo-overlay {
  opacity: 1;
}

.character-name-display {
  text-align: center;
}

.character-name-display h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
}

.character-username {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Sections */
.character-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.section-title {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
}

/* Fields Grid */
.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field input,
.field select {
  padding: 0.5rem 0.6rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus,
.field select:focus {
  border-color: var(--accent);
}

.field select {
  cursor: pointer;
}

.field-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  padding: 0.5rem 0;
}

/* Radar Chart */
.radar-container {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

/* Stat Sliders (edit mode) */
.stats-sliders {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.stat-slider label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-emoji {
  font-size: 1rem;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.2rem;
}

.slider-row input[type="range"] {
  flex: 1;
  accent-color: var(--accent);
  height: 6px;
}

.stat-num {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  min-width: 28px;
  text-align: right;
}

/* Stat Bars (view mode) */
.stats-bars {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1rem;
}

.stat-bar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-bar-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 100px;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.stat-bar-track {
  flex: 1;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.stat-bar-value {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  min-width: 24px;
  text-align: right;
}

/* Save */
.save-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.save-btn {
  padding: 0.6rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.save-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-msg {
  font-size: 0.85rem;
  font-weight: 500;
}

.save-msg.success {
  color: var(--success);
}

.save-msg.error {
  color: var(--danger);
}

/* Inventory */
.inv-badge {
  font-size: 0.7rem;
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  margin-left: 0.3rem;
}

.empty-inv {
  text-align: center;
  color: var(--text-secondary);
  padding: 1rem 0;
  font-size: 0.88rem;
}

.inv-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.inv-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.65rem 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 0.15s;
}
.inv-card:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.inv-icon { font-size: 1.5rem; line-height: 1; }
.inv-name { font-size: 0.75rem; font-weight: 600; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.inv-qty { font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; }

.inv-remove {
  position: absolute; top: 2px; right: 4px;
  background: none; border: none; color: var(--text-secondary);
  cursor: pointer; font-size: 0.65rem; padding: 2px;
  opacity: 0; transition: opacity 0.15s;
}
.inv-card:hover .inv-remove { opacity: 1; }
.inv-remove:hover { color: var(--danger); }

.inv-add-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.15rem; padding: 0.65rem 0.5rem;
  background: none; border: 1px dashed var(--border); border-radius: 10px;
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.inv-add-card:hover { border-color: var(--accent); color: var(--accent); }
.inv-add-plus { font-size: 1.3rem; line-height: 1; }
.inv-add-label { font-size: 0.72rem; font-weight: 600; }

.inv-img {
  width: 40px; height: 40px; object-fit: cover; border-radius: 6px;
}

.inv-visual-toggle {
  display: flex; gap: 0.35rem;
}
.inv-visual-toggle button {
  flex: 1; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-primary); color: var(--text-secondary); cursor: pointer;
  font-size: 0.82rem; font-family: inherit; transition: all 0.15s;
}
.inv-visual-toggle button.active {
  border-color: var(--accent); color: var(--accent); background: rgba(29,161,242,0.08);
}

.inv-img-upload-btn {
  width: 100%; padding: 1.2rem; border: 1px dashed var(--border); border-radius: 10px;
  background: none; color: var(--text-secondary); cursor: pointer; font-size: 0.88rem;
  font-family: inherit; transition: all 0.15s;
}
.inv-img-upload-btn:hover { border-color: var(--accent); color: var(--accent); }

.inv-img-preview-wrap {
  position: relative; display: inline-block;
}
.inv-img-preview {
  width: 100%; max-height: 140px; object-fit: contain; border-radius: 8px;
  border: 1px solid var(--border);
}
.inv-img-remove {
  position: absolute; top: 4px; right: 4px; width: 24px; height: 24px;
  border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: none;
  cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; backdrop-filter: blur(2px);
}
.modal-box {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 16px; padding: 1.25rem; width: 380px;
  max-width: 90vw; max-height: 80vh; overflow-y: auto;
}
.modal-title { margin: 0 0 1rem; font-size: 1.05rem; }
.modal-field { margin-bottom: 0.85rem; }
.modal-field label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
.modal-field input {
  width: 100%; padding: 0.5rem 0.65rem; border: 1px solid var(--border);
  border-radius: 8px; background: var(--bg-primary); color: var(--text-primary);
  font-size: 0.9rem; box-sizing: border-box; font-family: inherit;
}
.modal-field input:focus { outline: none; border-color: var(--accent); }

.emoji-grid { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.emoji-btn {
  width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 6px;
  background: none; font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.12s;
}
.emoji-btn:hover { background: var(--bg-hover); transform: scale(1.1); }
.emoji-btn.selected { border-color: var(--accent); background: rgba(29,161,242,0.15); }

.qty-control { display: flex; align-items: center; gap: 0.75rem; }
.qty-control button {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border);
  background: none; color: var(--text-primary); font-size: 1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.qty-control button:hover { background: var(--bg-hover); border-color: var(--accent); }
.qty-control span { font-size: 1rem; font-weight: 700; min-width: 20px; text-align: center; }

.modal-error { color: var(--danger); font-size: 0.82rem; margin: 0.5rem 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }
.modal-cancel { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.88rem; font-family: inherit; }
.modal-save {
  padding: 0.45rem 1rem; border: none; border-radius: 8px;
  background: var(--accent); color: white; font-size: 0.88rem; cursor: pointer; font-family: inherit;
}
.modal-save:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .fields-grid {
    grid-template-columns: 1fr;
  }

  .inv-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .character-page {
    padding-bottom: calc(var(--mobile-nav-height, 56px) + 1rem);
  }
}
</style>
