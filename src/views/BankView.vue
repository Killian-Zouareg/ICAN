<template>
  <div class="bank-page">
    <!-- Top bar -->
    <div class="bank-top-bar">
      <button @click="$router.back()" class="back-btn">&larr;</button>
      <h1 class="top-bar-title">iBank</h1>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <template v-else>
      <div class="bank-content">
        <!-- Balance Card -->
        <div class="balance-card">
          <span class="balance-label">Solde disponible</span>
          <span class="balance-amount">
            ${{ formatBalance(account?.balance || 0) }}
          </span>
        </div>

        <!-- Transfer Section -->
        <div class="bank-section">
          <h3 class="section-title">Envoyer de l'argent</h3>

          <!-- Transfer mode toggle -->
          <div class="transfer-mode-toggle">
            <button
              class="mode-btn"
              :class="{ active: transferMode === 'profile' }"
              @click="switchTransferMode('profile')"
            >
              &#x1F464; Joueur
            </button>
            <button
              class="mode-btn"
              :class="{ active: transferMode === 'location' }"
              @click="switchTransferMode('location')"
            >
              &#x1F3EA; Commerce / Lieu
            </button>
          </div>

          <!-- Recipient search (profile mode) -->
          <div v-if="transferMode === 'profile'" class="field">
            <label>Destinataire</label>
            <div class="recipient-search">
              <input
                v-model="recipientQuery"
                type="text"
                placeholder="Rechercher un profil..."
                @input="onSearchRecipient"
              />
              <div v-if="recipientResults.length > 0 && !selectedRecipient" class="recipient-dropdown">
                <div
                  v-for="r in recipientResults"
                  :key="r.id"
                  class="recipient-item"
                  @click="selectRecipient(r)"
                >
                  <UserAvatar :url="r.avatar_url" :name="r.display_name" :size="28" />
                  <div class="recipient-info">
                    <span class="recipient-name">{{ r.display_name }}</span>
                    <span class="recipient-handle">@{{ r.username }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedRecipient" class="selected-recipient">
              <UserAvatar :url="selectedRecipient.avatar_url" :name="selectedRecipient.display_name" :size="24" />
              <span>@{{ selectedRecipient.username }}</span>
              <button class="clear-recipient" @click="clearRecipient">&times;</button>
            </div>
          </div>

          <!-- Location search (location mode) -->
          <div v-if="transferMode === 'location'" class="field">
            <label>Lieu / Commerce</label>
            <div class="recipient-search">
              <input
                v-model="locationQuery"
                type="text"
                placeholder="Rechercher un lieu..."
                @input="onSearchLocation"
              />
              <div v-if="locationResults.length > 0 && !selectedLocation" class="recipient-dropdown">
                <div
                  v-for="loc in locationResults"
                  :key="loc.id"
                  class="recipient-item"
                  @click="selectLocationRecipient(loc)"
                >
                  <span class="loc-recipient-emoji" :style="{ background: getCatColor(loc.category) + '30', color: getCatColor(loc.category) }">
                    {{ getCatEmoji(loc.category) }}
                  </span>
                  <div class="recipient-info">
                    <span class="recipient-name">{{ loc.name }}</span>
                    <span class="recipient-handle">{{ getCatLabel(loc.category) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedLocation" class="selected-recipient">
              <span class="loc-recipient-emoji loc-recipient-emoji-sm" :style="{ background: getCatColor(selectedLocation.category) + '30', color: getCatColor(selectedLocation.category) }">
                {{ getCatEmoji(selectedLocation.category) }}
              </span>
              <span>{{ selectedLocation.name }}</span>
              <button class="clear-recipient" @click="clearLocation">&times;</button>
            </div>
          </div>

          <div class="transfer-row">
            <div class="field">
              <label>Montant ($)</label>
              <input v-model.number="transferAmount" type="number" min="1" placeholder="0" />
            </div>
            <div class="field field-note">
              <label>Note (optionnel)</label>
              <input v-model="transferNote" type="text" maxlength="100" :placeholder="transferMode === 'location' ? 'Achat, service...' : 'Motif du transfert'" />
            </div>
          </div>

          <button
            class="transfer-btn"
            :disabled="!canTransfer || sending"
            @click="doTransfer"
          >
            {{ sending ? 'Envoi...' : 'Envoyer' }}
          </button>
          <span v-if="transferMsg" class="transfer-msg" :class="transferMsgType">{{ transferMsg }}</span>
        </div>

        <!-- Admin Section -->
        <div v-if="auth.isAdmin" class="bank-section admin-section">
          <h3 class="section-title">&#x1F6E1; Administration</h3>

          <div class="field">
            <label>Profil cible</label>
            <div class="recipient-search">
              <input
                v-model="adminQuery"
                type="text"
                placeholder="Rechercher un profil..."
                @input="onSearchAdmin"
              />
              <div v-if="adminResults.length > 0 && !adminTarget" class="recipient-dropdown">
                <div
                  v-for="r in adminResults"
                  :key="r.id"
                  class="recipient-item"
                  @click="selectAdminTarget(r)"
                >
                  <UserAvatar :url="r.avatar_url" :name="r.display_name" :size="28" />
                  <div class="recipient-info">
                    <span class="recipient-name">{{ r.display_name }}</span>
                    <span class="recipient-handle">@{{ r.username }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="adminTarget" class="selected-recipient">
              <UserAvatar :url="adminTarget.avatar_url" :name="adminTarget.display_name" :size="24" />
              <span>@{{ adminTarget.username }}</span>
              <button class="clear-recipient" @click="adminTarget = null; adminQuery = ''">&times;</button>
            </div>
          </div>

          <div class="transfer-row">
            <div class="field">
              <label>Montant ($)</label>
              <input v-model.number="adminAmount" type="number" placeholder="Positif = cr&eacute;dit, N&eacute;gatif = d&eacute;bit" />
            </div>
            <div class="field field-note">
              <label>Note</label>
              <input v-model="adminNote" type="text" maxlength="100" placeholder="Raison" />
            </div>
          </div>

          <button
            class="transfer-btn admin-btn"
            :disabled="!adminTarget || !adminAmount || sending"
            @click="doAdminAdjust"
          >
            {{ sending ? 'Envoi...' : 'Appliquer' }}
          </button>
          <span v-if="adminMsg" class="transfer-msg" :class="adminMsgType">{{ adminMsg }}</span>
        </div>

        <!-- Transaction History -->
        <div class="bank-section">
          <h3 class="section-title">Historique</h3>
          <div v-if="transactions.length === 0" class="no-transactions">
            Aucune transaction pour le moment.
          </div>
          <div v-else class="transaction-list">
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="transaction-item"
            >
              <div class="tx-icon" :class="txDirection(tx)">
                {{ txDirection(tx) === 'incoming' ? '&#x2B06;' : '&#x2B07;' }}
              </div>
              <div class="tx-details">
                <div class="tx-parties">
                  <template v-if="isAdminTx(tx)">
                    <span class="tx-admin-badge">ADMIN</span>
                    <span class="tx-party">{{ tx.sender?.display_name }}</span>
                  </template>
                  <template v-else-if="isSpendTx(tx)">
                    <span class="tx-spend-badge">&#x1F3EA;</span>
                    <span class="tx-party">D&eacute;pense</span>
                  </template>
                  <template v-else-if="txDirection(tx) === 'incoming'">
                    <span class="tx-from">De</span>
                    <router-link :to="`/user/${tx.sender?.username}`" class="tx-party">
                      {{ tx.sender?.display_name }}
                    </router-link>
                  </template>
                  <template v-else>
                    <span class="tx-from">&Agrave;</span>
                    <router-link :to="`/user/${tx.receiver?.username}`" class="tx-party">
                      {{ tx.receiver?.display_name }}
                    </router-link>
                  </template>
                </div>
                <span v-if="tx.note" class="tx-note">{{ tx.note }}</span>
                <span class="tx-date">{{ timeAgo(tx.created_at) }}</span>
              </div>
              <span class="tx-amount" :class="txDirection(tx)">
                {{ txDirection(tx) === 'incoming' ? '+' : '-' }}${{ formatBalance(Math.abs(tx.amount)) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useBankStore } from '../stores/bank'
import { useMapLocationsStore } from '../stores/mapLocations'
import { timeAgo } from '../lib/time'
import UserAvatar from '../components/UserAvatar.vue'

const auth = useAuthStore()
const bankStore = useBankStore()
const mapStore = useMapLocationsStore()

const loading = ref(true)
const sending = ref(false)

// Transfer mode
const transferMode = ref('profile') // 'profile' | 'location'

// Transfer form - profile mode
const recipientQuery = ref('')
const recipientResults = ref([])
const selectedRecipient = ref(null)
const transferAmount = ref(null)
const transferNote = ref('')
const transferMsg = ref('')
const transferMsgType = ref('')

// Transfer form - location mode
const locationQuery = ref('')
const locationResults = ref([])
const selectedLocation = ref(null)

// Admin form
const adminQuery = ref('')
const adminResults = ref([])
const adminTarget = ref(null)
const adminAmount = ref(null)
const adminNote = ref('')
const adminMsg = ref('')
const adminMsgType = ref('')

const account = computed(() => bankStore.account)
const transactions = computed(() => bankStore.transactions)

const canTransfer = computed(() => {
  if (!transferAmount.value || transferAmount.value <= 0) return false
  if (transferMode.value === 'profile') return !!selectedRecipient.value
  return !!selectedLocation.value
})

// Category helpers for location mode
function getCatColor(cat) {
  return mapStore.CATEGORIES[cat]?.color || '#8899a6'
}
function getCatEmoji(cat) {
  return mapStore.CATEGORIES[cat]?.emoji || '\u{1F4CD}'
}
function getCatLabel(cat) {
  return mapStore.CATEGORIES[cat]?.label || 'Autre'
}

function switchTransferMode(mode) {
  transferMode.value = mode
  clearRecipient()
  clearLocation()
  transferAmount.value = null
  transferNote.value = ''
  transferMsg.value = ''
}

let searchTimeout = null

function onSearchRecipient() {
  selectedRecipient.value = null
  clearTimeout(searchTimeout)
  if (!recipientQuery.value.trim()) {
    recipientResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    recipientResults.value = await bankStore.searchRecipient(recipientQuery.value.trim())
  }, 300)
}

function selectRecipient(profile) {
  selectedRecipient.value = profile
  recipientQuery.value = profile.display_name
  recipientResults.value = []
}

function clearRecipient() {
  selectedRecipient.value = null
  recipientQuery.value = ''
  recipientResults.value = []
}

function onSearchLocation() {
  selectedLocation.value = null
  const q = locationQuery.value.trim().toLowerCase()
  if (!q) {
    locationResults.value = []
    return
  }
  // Ensure locations are loaded
  if (mapStore.locations.length === 0) {
    mapStore.fetchLocations().then(() => filterLocations(q))
  } else {
    filterLocations(q)
  }
}

function filterLocations(q) {
  locationResults.value = mapStore.locations
    .filter(l => l.name.toLowerCase().includes(q))
    .slice(0, 8)
}

function selectLocationRecipient(loc) {
  selectedLocation.value = loc
  locationQuery.value = loc.name
  locationResults.value = []
}

function clearLocation() {
  selectedLocation.value = null
  locationQuery.value = ''
  locationResults.value = []
}

async function doTransfer() {
  if (!canTransfer.value || !auth.activeProfile) return
  sending.value = true
  transferMsg.value = ''
  try {
    if (transferMode.value === 'profile') {
      await bankStore.transfer(
        auth.activeProfile.id,
        selectedRecipient.value.id,
        transferAmount.value,
        transferNote.value
      )
      clearRecipient()
    } else {
      const note = transferNote.value
        ? `${selectedLocation.value.name} — ${transferNote.value}`
        : selectedLocation.value.name
      await bankStore.spend(
        auth.activeProfile.id,
        transferAmount.value,
        note
      )
      clearLocation()
    }
    transferMsg.value = 'Transfert effectué !'
    transferMsgType.value = 'success'
    transferAmount.value = null
    transferNote.value = ''
  } catch (err) {
    transferMsg.value = err.message || 'Erreur lors du transfert.'
    transferMsgType.value = 'error'
  } finally {
    sending.value = false
    setTimeout(() => { transferMsg.value = '' }, 4000)
  }
}

// Admin search
let adminSearchTimeout = null

function onSearchAdmin() {
  adminTarget.value = null
  clearTimeout(adminSearchTimeout)
  if (!adminQuery.value.trim()) {
    adminResults.value = []
    return
  }
  adminSearchTimeout = setTimeout(async () => {
    adminResults.value = await bankStore.searchRecipient(adminQuery.value.trim())
  }, 300)
}

function selectAdminTarget(profile) {
  adminTarget.value = profile
  adminQuery.value = profile.display_name
  adminResults.value = []
}

async function doAdminAdjust() {
  if (!adminTarget.value || !adminAmount.value) return
  sending.value = true
  adminMsg.value = ''
  try {
    await bankStore.adminAdjustBalance(adminTarget.value.id, adminAmount.value, adminNote.value)
    adminMsg.value = 'Ajustement appliqué !'
    adminMsgType.value = 'success'
    adminTarget.value = null
    adminQuery.value = ''
    adminAmount.value = null
    adminNote.value = ''
    // Refresh own account in case it was affected
    await bankStore.fetchAccount(auth.activeProfile.id)
    await bankStore.fetchTransactions(auth.activeProfile.id)
  } catch (err) {
    adminMsg.value = err.message || 'Erreur.'
    adminMsgType.value = 'error'
  } finally {
    sending.value = false
    setTimeout(() => { adminMsg.value = '' }, 4000)
  }
}

function txDirection(tx) {
  if (!tx.receiver_id) return 'outgoing' // spend transaction
  if (tx.sender_id === tx.receiver_id) return tx.amount >= 0 ? 'incoming' : 'outgoing' // admin adjustment
  return tx.receiver_id === auth.activeProfile?.id ? 'incoming' : 'outgoing'
}

function isAdminTx(tx) {
  return tx.receiver_id && tx.sender_id === tx.receiver_id
}

function isSpendTx(tx) {
  return !tx.receiver_id
}

function formatBalance(n) {
  return Number(n || 0).toLocaleString('fr-FR')
}

async function loadData() {
  if (!auth.activeProfile) return
  loading.value = true
  try {
    await bankStore.fetchAccount(auth.activeProfile.id)
    await bankStore.fetchTransactions(auth.activeProfile.id)
  } finally {
    loading.value = false
  }
}

watch(() => auth.activeProfile?.id, () => {
  loadData()
})

onMounted(() => {
  loadData()
})
</script>

<style scoped src="./BankView.css"></style>
