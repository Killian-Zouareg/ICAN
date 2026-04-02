<template>
  <div class="ghost-modal-overlay" @click.self="$emit('close')">
    <div class="ghost-modal">
      <div class="ghost-modal-header">
        <span class="ghost-modal-title">⚡ Engagement Ghost</span>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="ghost-modal-body">
        <div v-if="loading" class="ghost-loading">Chargement...</div>
        <template v-else>
          <!-- Section compteurs virtuels -->
          <div class="ghost-section-title">Compteurs virtuels (illimité)</div>
          <div class="ghost-section-hint">Nombres ajoutés à l'affichage, aucune donnée générée</div>

          <div class="ghost-field">
            <label class="ghost-label">❤️ Faux likes</label>
            <input v-model.number="fakeLikes" type="number" min="0" class="ghost-input" />
          </div>

          <div class="ghost-field">
            <label class="ghost-label">💬 Faux commentaires</label>
            <input v-model.number="fakeComments" type="number" min="0" class="ghost-input" />
          </div>

          <div class="ghost-field">
            <label class="ghost-label">🔁 Faux reposts</label>
            <input v-model.number="fakeReposts" type="number" min="0" class="ghost-input" />
          </div>

          <!-- Section ghost réels -->
          <div class="ghost-section-title" style="margin-top: 0.75rem">Ghost réels (avec profils)</div>
          <div class="ghost-section-hint">Crée de vrais profils et interactions visibles</div>

          <div class="ghost-field">
            <label class="ghost-label">❤️ Ghost likes</label>
            <input v-model.number="likesCount" type="number" min="0" max="200" class="ghost-input" />
          </div>

          <div class="ghost-field">
            <label class="ghost-label">💬 Ghost commentaires</label>
            <input v-model.number="commentsCount" type="number" min="0" max="200" class="ghost-input" />
          </div>

          <div v-if="commentsCount > 0" class="ghost-field">
            <label class="ghost-label">🎭 Humeur des commentaires</label>
            <select v-model="selectedMood" class="ghost-select">
              <option v-for="m in moods" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>

          <div v-if="applying" class="ghost-progress">
            Application en cours... ({{ progressText }})
          </div>

          <div class="ghost-modal-actions">
            <button class="ghost-btn-clear" @click="clearAll" :disabled="applying">
              🗑️ Tout effacer
            </button>
            <button class="ghost-btn-apply" @click="applyAll" :disabled="applying">
              {{ applying ? '...' : '✓ Appliquer' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGhostEngagementStore } from '../stores/ghostEngagement'
import { moods } from '../lib/ghostData'

const props = defineProps({
  postId: { type: String, required: true },
})

const emit = defineEmits(['close', 'applied'])

const ghostStore = useGhostEngagementStore()

const loading = ref(true)
const applying = ref(false)
const progressText = ref('')

// Compteurs virtuels (juste des nombres, pas de lignes en base)
const fakeLikes = ref(0)
const fakeComments = ref(0)
const fakeReposts = ref(0)

// Ghost réels (profils + interactions)
const likesCount = ref(0)
const commentsCount = ref(0)
const selectedMood = ref('joyeux')

onMounted(async () => {
  const counts = await ghostStore.fetchGhostCounts(props.postId)
  likesCount.value = counts.likes
  commentsCount.value = counts.comments
  fakeLikes.value = counts.fakeLikes
  fakeComments.value = counts.fakeComments
  fakeReposts.value = counts.reposts
  if (counts.comments > 0) {
    selectedMood.value = await ghostStore.fetchGhostCommentsMood(props.postId)
  }
  loading.value = false
})

async function applyAll() {
  applying.value = true
  try {
    progressText.value = 'compteurs virtuels...'
    await ghostStore.setFakeCounts(props.postId, {
      fakeLikes: fakeLikes.value,
      fakeComments: fakeComments.value,
      fakeReposts: fakeReposts.value,
    })

    progressText.value = 'ghost likes...'
    await ghostStore.setGhostLikes(props.postId, likesCount.value)

    progressText.value = 'ghost commentaires...'
    await ghostStore.setGhostComments(props.postId, commentsCount.value, selectedMood.value)

    emit('applied')
    emit('close')
  } catch (e) {
    alert(e.message || 'Erreur lors de la génération')
  } finally {
    applying.value = false
    progressText.value = ''
  }
}

async function clearAll() {
  applying.value = true
  try {
    await ghostStore.clearGhostEngagement(props.postId)
    await ghostStore.setFakeCounts(props.postId, { fakeLikes: 0, fakeComments: 0, fakeReposts: 0 })
    likesCount.value = 0
    commentsCount.value = 0
    fakeLikes.value = 0
    fakeComments.value = 0
    fakeReposts.value = 0
    emit('applied')
    emit('close')
  } catch (e) {
    alert(e.message || 'Erreur lors de la suppression')
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.ghost-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ghost-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: 340px;
  max-width: 95vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.ghost-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.ghost-modal-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--danger);
}

.ghost-modal-body {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.ghost-section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.ghost-section-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: -0.5rem;
}

.ghost-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 1rem 0;
  font-size: 0.9rem;
}

.ghost-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ghost-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.ghost-input,
.ghost-select {
  padding: 0.45rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
  width: 100%;
}

.ghost-input:focus,
.ghost-select:focus {
  outline: none;
  border-color: var(--accent);
}

.ghost-progress {
  font-size: 0.82rem;
  color: var(--accent);
  text-align: center;
}

.ghost-modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.ghost-btn-clear {
  flex: 1;
  padding: 0.5rem;
  background: none;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.ghost-btn-clear:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}

.ghost-btn-apply {
  flex: 2;
  padding: 0.5rem;
  background: var(--accent);
  border: none;
  border-radius: 20px;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.ghost-btn-apply:hover:not(:disabled) {
  background: var(--accent-hover);
}

.ghost-btn-clear:disabled,
.ghost-btn-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
