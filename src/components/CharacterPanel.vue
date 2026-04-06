<template>
  <div class="char-panel">
    <!-- Stats Section -->
    <div class="char-section">
      <h3 class="char-section-title">
        <span class="char-icon">&#x2694;</span> Stats
      </h3>
      <div class="stats-grid">
        <div v-for="stat in statsList" :key="stat.key" class="stat-row">
          <span class="stat-label">{{ stat.label }}</span>
          <div class="stat-dots">
            <span
              v-for="i in 5"
              :key="i"
              class="stat-dot"
              :class="{ filled: i <= localStats[stat.key], clickable: isOwner }"
              :style="i <= localStats[stat.key] ? { background: stat.color, boxShadow: '0 0 6px ' + stat.color + '60' } : {}"
              @click="isOwner && setStat(stat.key, i)"
            ></span>
          </div>
          <span class="stat-value" :style="{ color: stat.color }">{{ localStats[stat.key] }}</span>
        </div>
      </div>
      <button v-if="isOwner && statsChanged" class="save-stats-btn" @click="saveStats" :disabled="savingStats">
        {{ savingStats ? 'Sauvegarde...' : 'Sauvegarder les stats' }}
      </button>
    </div>

    <!-- Inventory Section -->
    <div class="char-section">
      <h3 class="char-section-title">
        <span class="char-icon">&#x1F392;</span> Inventaire
        <span v-if="inventory.length > 0" class="inv-count">{{ inventory.length }}</span>
      </h3>

      <div v-if="loadingInventory" class="char-loading">Chargement...</div>
      <div v-else-if="inventory.length === 0 && !isOwner" class="char-empty">Inventaire vide</div>
      <div v-else class="inv-grid">
        <div
          v-for="item in inventory"
          :key="item.id"
          class="inv-card"
          :title="item.description || item.name"
        >
          <span class="inv-icon">{{ item.icon }}</span>
          <span class="inv-name">{{ item.name }}</span>
          <span v-if="item.quantity > 1" class="inv-qty">x{{ item.quantity }}</span>
          <button v-if="isOwner" class="inv-remove" @click="removeItem(item.id)" title="Supprimer">&#x2715;</button>
        </div>

        <button v-if="isOwner" class="inv-add-card" @click="showAddModal = true">
          <span class="inv-add-icon">+</span>
          <span class="inv-add-text">Ajouter</span>
        </button>
      </div>

      <button v-if="isOwner && inventory.length === 0" class="inv-add-empty" @click="showAddModal = true">
        + Ajouter un objet
      </button>
    </div>

    <!-- Add Item Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="modal-overlay" @click="showAddModal = false">
        <div class="modal-box" @click.stop>
          <h3 class="modal-title">Nouvel objet</h3>

          <div class="modal-field">
            <label>Icone</label>
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

          <div class="modal-field">
            <label>Nom</label>
            <input v-model="newItem.name" type="text" maxlength="50" placeholder="Nom de l'objet" />
          </div>

          <div class="modal-field">
            <label>Description (optionnel)</label>
            <input v-model="newItem.description" type="text" maxlength="200" placeholder="Description courte" />
          </div>

          <div class="modal-field">
            <label>Quantite</label>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({
  profileId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
  characterStats: { type: Object, default: () => ({ charisme: 0, intelligence: 0, force: 0, vigueur: 0, mobilite: 0 }) },
})

const emit = defineEmits(['stats-updated'])

const statsList = [
  { key: 'charisme', label: 'Charisme', color: '#e74c3c' },
  { key: 'intelligence', label: 'Intelligence', color: '#3498db' },
  { key: 'force', label: 'Force', color: '#e67e22' },
  { key: 'vigueur', label: 'Vigueur', color: '#2ecc71' },
  { key: 'mobilite', label: 'Mobilite', color: '#9b59b6' },
]

const defaultStats = { charisme: 0, intelligence: 0, force: 0, vigueur: 0, mobilite: 0 }

const localStats = reactive({ ...defaultStats })
const originalStats = ref({ ...defaultStats })
const savingStats = ref(false)

const inventory = ref([])
const loadingInventory = ref(false)
const showAddModal = ref(false)
const addingItem = ref(false)
const addError = ref('')

const newItem = reactive({
  name: '',
  description: '',
  icon: '📦',
  quantity: 1,
})

const emojiOptions = [
  '⚔️', '🗡️', '🏹', '🔫', '💣', '🛡️', '🪖', '👑',
  '💍', '📿', '🧪', '🧬', '💎', '🔮', '📜', '🗝️',
  '🎒', '📦', '🧰', '🎭', '🧲', '⚡', '🔥', '❄️',
  '🌟', '💰', '🍖', '🧃', '🏆', '🎯', '🛸', '🐉',
]

const statsChanged = computed(() => {
  return statsList.some((s) => localStats[s.key] !== originalStats.value[s.key])
})

function initStats() {
  const src = props.characterStats || defaultStats
  for (const s of statsList) {
    localStats[s.key] = src[s.key] ?? 0
    originalStats.value[s.key] = src[s.key] ?? 0
  }
}

function setStat(key, val) {
  // Click same dot = toggle off
  localStats[key] = localStats[key] === val ? val - 1 : val
}

async function saveStats() {
  savingStats.value = true
  try {
    const stats = {}
    for (const s of statsList) stats[s.key] = localStats[s.key]
    const { error } = await supabase
      .from('profiles')
      .update({ character_stats: stats })
      .eq('id', props.profileId)
    if (error) throw error
    originalStats.value = { ...stats }
    emit('stats-updated', stats)
  } catch {
    // silent
  } finally {
    savingStats.value = false
  }
}

async function fetchInventory() {
  loadingInventory.value = true
  try {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('profile_id', props.profileId)
      .order('created_at', { ascending: true })
    inventory.value = data || []
  } catch {
    // silent
  } finally {
    loadingInventory.value = false
  }
}

async function addItem() {
  addError.value = ''
  if (!newItem.name.trim()) {
    addError.value = "Le nom est requis"
    return
  }
  addingItem.value = true
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        profile_id: props.profileId,
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        icon: newItem.icon,
        quantity: newItem.quantity,
      })
      .select()
      .single()
    if (error) throw error
    inventory.value.push(data)
    showAddModal.value = false
    newItem.name = ''
    newItem.description = ''
    newItem.icon = '📦'
    newItem.quantity = 1
  } catch (e) {
    addError.value = e.message || 'Erreur'
  } finally {
    addingItem.value = false
  }
}

async function removeItem(itemId) {
  await supabase.from('inventory_items').delete().eq('id', itemId)
  inventory.value = inventory.value.filter((i) => i.id !== itemId)
}

watch(() => props.profileId, () => {
  initStats()
  fetchInventory()
})

watch(() => props.characterStats, initStats, { deep: true })

onMounted(() => {
  initStats()
  fetchInventory()
})
</script>

<style scoped>
.char-panel {
  padding: 1rem;
}

.char-section {
  margin-bottom: 1.5rem;
}

.char-section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.char-icon {
  font-size: 1.1rem;
}

.inv-count {
  font-size: 0.7rem;
  background: var(--bg-hover);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}

/* ---- Stats ---- */
.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-label {
  width: 100px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.stat-dots {
  display: flex;
  gap: 0.35rem;
}

.stat-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: transparent;
  transition: all 0.2s;
}

.stat-dot.clickable {
  cursor: pointer;
}

.stat-dot.clickable:hover {
  transform: scale(1.2);
}

.stat-dot.filled {
  border-color: transparent;
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 700;
  width: 20px;
  text-align: center;
}

.save-stats-btn {
  margin-top: 0.75rem;
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}

.save-stats-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Inventory ---- */
.char-loading, .char-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
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

.inv-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.inv-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.inv-qty {
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.inv-remove {
  position: absolute;
  top: 2px;
  right: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.65rem;
  padding: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.inv-card:hover .inv-remove {
  opacity: 1;
}

.inv-remove:hover {
  color: var(--danger);
}

.inv-add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.65rem 0.5rem;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.inv-add-card:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.inv-add-icon {
  font-size: 1.3rem;
  line-height: 1;
}

.inv-add-text {
  font-size: 0.72rem;
  font-weight: 600;
}

.inv-add-empty {
  width: 100%;
  padding: 0.6rem;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.88rem;
  font-family: inherit;
}

.inv-add-empty:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  backdrop-filter: blur(2px);
}

.modal-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  width: 380px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.modal-field {
  margin-bottom: 0.85rem;
}

.modal-field label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.modal-field input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  box-sizing: border-box;
  font-family: inherit;
}

.modal-field input:focus {
  outline: none;
  border-color: var(--accent);
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.emoji-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.emoji-btn:hover {
  background: var(--bg-hover);
  transform: scale(1.1);
}

.emoji-btn.selected {
  border-color: var(--accent);
  background: rgba(29, 161, 242, 0.15);
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.qty-control button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-control button:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.qty-control span {
  font-size: 1rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

.modal-error {
  color: var(--danger);
  font-size: 0.82rem;
  margin: 0.5rem 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

.modal-cancel {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.88rem;
  font-family: inherit;
}

.modal-save {
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 0.88rem;
  cursor: pointer;
  font-family: inherit;
}

.modal-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Mobile ---- */
@media (max-width: 600px) {
  .inv-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-label {
    width: 80px;
    font-size: 0.78rem;
  }
}
</style>
