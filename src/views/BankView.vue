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

          <!-- Recipient search -->
          <div class="field">
            <label>Destinataire</label>
            <div class="recipient-search">
              <input
                v-model="recipientQuery"
                type="text"
                placeholder="Rechercher un profil..."
                @input="onSearchRecipient"
              />
              <!-- Dropdown -->
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
            <!-- Selected recipient badge -->
            <div v-if="selectedRecipient" class="selected-recipient">
              <UserAvatar :url="selectedRecipient.avatar_url" :name="selectedRecipient.display_name" :size="24" />
              <span>@{{ selectedRecipient.username }}</span>
              <button class="clear-recipient" @click="clearRecipient">&times;</button>
            </div>
          </div>

          <div class="transfer-row">
            <div class="field">
              <label>Montant ($)</label>
              <input v-model.number="transferAmount" type="number" min="1" placeholder="0" />
            </div>
            <div class="field field-note">
              <label>Note (optionnel)</label>
              <input v-model="transferNote" type="text" maxlength="100" placeholder="Motif du transfert" />
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
                {{ txDirection(tx) === 'incoming' ? '+' : '-' }}${{ formatBalance(tx.amount) }}
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
import { timeAgo } from '../lib/time'
import UserAvatar from '../components/UserAvatar.vue'

const auth = useAuthStore()
const bankStore = useBankStore()

const loading = ref(true)
const sending = ref(false)

// Transfer form
const recipientQuery = ref('')
const recipientResults = ref([])
const selectedRecipient = ref(null)
const transferAmount = ref(null)
const transferNote = ref('')
const transferMsg = ref('')
const transferMsgType = ref('')

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

const canTransfer = computed(() =>
  selectedRecipient.value && transferAmount.value && transferAmount.value > 0
)

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

async function doTransfer() {
  if (!canTransfer.value || !auth.activeProfile) return
  sending.value = true
  transferMsg.value = ''
  try {
    await bankStore.transfer(
      auth.activeProfile.id,
      selectedRecipient.value.id,
      transferAmount.value,
      transferNote.value
    )
    transferMsg.value = 'Transfert effectué !'
    transferMsgType.value = 'success'
    clearRecipient()
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
  if (tx.sender_id === tx.receiver_id) return 'incoming' // admin adjustment
  return tx.receiver_id === auth.activeProfile?.id ? 'incoming' : 'outgoing'
}

function isAdminTx(tx) {
  return tx.sender_id === tx.receiver_id
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

<style scoped>
.bank-page {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

.bank-top-bar {
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

.bank-content {
  padding: 1rem;
}

/* Balance Card */
.balance-card {
  background: linear-gradient(135deg, #1a91da, #1da1f2);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  margin-bottom: 1rem;
  box-shadow: 0 4px 20px rgba(29, 161, 242, 0.2);
}

.balance-label {
  display: block;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.3rem;
}

.balance-amount {
  font-size: 2.2rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
}

/* Sections */
.bank-section {
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

.admin-section {
  border-color: rgba(255, 215, 0, 0.3);
}

.admin-section .section-title {
  color: var(--hero-primary);
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
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

.field input:focus {
  border-color: var(--accent);
}

.transfer-row {
  display: flex;
  gap: 0.75rem;
}

.transfer-row .field {
  flex: 1;
}

.field-note {
  flex: 2 !important;
}

/* Recipient Search */
.recipient-search {
  position: relative;
}

.recipient-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 20;
  max-height: 200px;
  overflow-y: auto;
}

.recipient-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  cursor: pointer;
  transition: background 0.15s;
}

.recipient-item:hover {
  background: var(--bg-hover);
}

.recipient-info {
  display: flex;
  flex-direction: column;
}

.recipient-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.recipient-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.selected-recipient {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  background: var(--bg-hover);
  border-radius: 20px;
  font-size: 0.85rem;
  color: var(--text-primary);
  width: fit-content;
  margin-top: 0.3rem;
}

.clear-recipient {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 0.2rem;
  line-height: 1;
}

.clear-recipient:hover {
  color: var(--danger);
}

/* Transfer button */
.transfer-btn {
  padding: 0.6rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 0.25rem;
}

.transfer-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.transfer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-btn {
  background: var(--hero-primary);
  color: #000;
}

.admin-btn:hover:not(:disabled) {
  background: #e6c200;
}

.transfer-msg {
  font-size: 0.85rem;
  font-weight: 500;
  margin-left: 0.5rem;
}

.transfer-msg.success {
  color: var(--success);
}

.transfer-msg.error {
  color: var(--danger);
}

/* Transaction History */
.no-transactions {
  text-align: center;
  color: var(--text-secondary);
  padding: 1.5rem 0;
  font-size: 0.9rem;
}

.transaction-list {
  display: flex;
  flex-direction: column;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--border);
}

.transaction-item:last-child {
  border-bottom: none;
}

.tx-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.tx-icon.incoming {
  background: rgba(23, 191, 99, 0.15);
  color: var(--success);
}

.tx-icon.outgoing {
  background: rgba(224, 36, 94, 0.15);
  color: var(--danger);
}

.tx-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.tx-parties {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
}

.tx-from {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.tx-party {
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
}

.tx-party:hover {
  text-decoration: underline;
}

.tx-admin-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--hero-primary);
  color: #000;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.tx-note {
  font-size: 0.8rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.tx-amount {
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.tx-amount.incoming {
  color: var(--success);
}

.tx-amount.outgoing {
  color: var(--danger);
}

@media (max-width: 768px) {
  .bank-page {
    padding-bottom: calc(var(--mobile-nav-height, 56px) + 1rem);
  }

  .transfer-row {
    flex-direction: column;
  }

  .balance-amount {
    font-size: 1.8rem;
  }
}
</style>
