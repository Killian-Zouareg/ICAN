<template>
  <div class="dm-widget" :class="{ expanded: isExpanded, 'conv-open': activeConv }">
    <!-- Collapsed bar -->
    <div class="dm-bar" @click="toggle">
      <span class="dm-bar-icon">&#x2709;</span>
      <span class="dm-bar-title">{{ barTitle }}</span>
      <span v-if="unreadCount > 0 && !isExpanded" class="dm-bar-badge">{{ unreadCount }}</span>
      <span class="dm-bar-toggle">{{ isExpanded ? '&#x25BC;' : '&#x25B2;' }}</span>
    </div>

    <!-- Expanded panel -->
    <div v-if="isExpanded" class="dm-panel">
      <!-- Conversation view -->
      <template v-if="activeConv">
        <div class="dm-conv-header">
          <button class="dm-back-btn" @click="closeConversation">&larr;</button>
          <UserAvatar
            v-if="activeConv.otherUser"
            :url="activeConv.otherUser.avatar_url"
            :name="activeConv.otherUser.display_name || '?'"
            :size="24"
          />
          <span class="dm-conv-name">{{ activeConv.otherUser?.display_name }}</span>
        </div>
        <div class="dm-messages" ref="messagesContainer">
          <div v-if="loadingMessages" class="dm-loading">Chargement...</div>
          <template v-else>
            <div v-if="messages.length === 0" class="dm-empty-conv">
              D&eacute;but de la conversation
            </div>
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="dm-bubble"
              :class="{ mine: isMine(msg) }"
            >
              <img
                v-if="msg.image_url"
                :src="msg.image_url"
                alt="Image"
                class="dm-bubble-image"
                @click="openImageUrl(msg.image_url)"
              />
              <p v-if="msg.content" class="dm-bubble-text">{{ msg.content }}</p>
              <span class="dm-bubble-time">{{ timeAgo(msg.created_at) }}</span>
            </div>
          </template>
        </div>
        <div v-if="imagePreview" class="dm-image-preview">
          <img :src="imagePreview" alt="Preview" />
          <button class="dm-remove-image" @click="removeImage">&times;</button>
        </div>
        <form class="dm-input" @submit.prevent="handleSend">
          <button type="button" class="dm-img-btn" @click="triggerFileInput" title="Envoyer une image">
            &#x1F5BC;
          </button>
          <input
            v-model="msgContent"
            type="text"
            placeholder="&Eacute;crire un message..."
            maxlength="1000"
          />
          <button type="submit" :disabled="!msgContent.trim() && !imageFile" class="dm-send-btn">&#x27A4;</button>
        </form>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style="display: none"
          @change="handleFileChange"
        />
      </template>

      <!-- Conversation list -->
      <template v-else>
        <!-- Search / New conversation -->
        <div class="dm-search-bar">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="showNewConv ? 'Rechercher un utilisateur...' : 'Rechercher une conversation...'"
            @input="handleSearch"
          />
          <button class="dm-new-btn" @click="showNewConv = !showNewConv" :title="showNewConv ? 'Annuler' : 'Nouveau message'">
            {{ showNewConv ? '&times;' : '+' }}
          </button>
        </div>

        <!-- New conversation results -->
        <div v-if="showNewConv && searchQuery.trim()" class="dm-search-results">
          <div v-if="searching" class="dm-loading">Recherche...</div>
          <div v-else-if="searchResults.length === 0" class="dm-empty">Aucun r&eacute;sultat</div>
          <div
            v-for="u in searchResults"
            :key="u.id"
            class="dm-conv-item"
            @click="startNewConversation(u)"
          >
            <UserAvatar :url="u.avatar_url" :name="u.display_name || u.username || '?'" :size="32" />
            <div class="dm-conv-info">
              <span class="dm-conv-item-name">{{ u.display_name }}</span>
              <span class="dm-conv-item-handle">@{{ u.username }}</span>
            </div>
          </div>
        </div>

        <!-- Conversation list -->
        <div v-else class="dm-conv-list">
          <div v-if="loadingConvs" class="dm-loading">Chargement...</div>
          <div v-else-if="filteredConversations.length === 0" class="dm-empty">
            {{ searchQuery.trim() ? 'Aucune conversation trouv\u00e9e' : 'Aucune conversation' }}
          </div>
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="dm-conv-item"
            :class="{ unread: conv.hasUnread }"
            @click="openConversation(conv)"
          >
            <UserAvatar
              :url="conv.otherUser.avatar_url"
              :name="conv.otherUser.display_name || '?'"
              :size="36"
            />
            <div class="dm-conv-info">
              <div class="dm-conv-item-top">
                <span class="dm-conv-item-name">{{ conv.otherUser.display_name }}</span>
                <span class="dm-conv-item-time">{{ conv.lastMessageTime ? timeAgo(conv.lastMessageTime) : '' }}</span>
              </div>
              <span class="dm-conv-item-preview">{{ conv.lastMessage || 'Nouvelle conversation' }}</span>
            </div>
            <span v-if="conv.hasUnread" class="dm-unread-dot"></span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import { checkRateLimit } from '../lib/rateLimit'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()

const isExpanded = ref(false)
const activeConv = ref(null)
const messages = ref([])
const msgContent = ref('')
const messagesContainer = ref(null)
const loadingMessages = ref(false)
const loadingConvs = ref(false)

// Image upload
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

const conversations = ref([])
const unreadCount = ref(0)

// Search
const searchQuery = ref('')
const showNewConv = ref(false)
const searchResults = ref([])
const searching = ref(false)
let searchTimeout = null

// Polling
let convPollInterval = null
let msgPollInterval = null

const barTitle = computed(() => {
  if (activeConv.value) return activeConv.value.otherUser?.display_name || 'Messages'
  return 'Messages'
})

const filteredConversations = computed(() => {
  if (!searchQuery.value.trim() || showNewConv.value) return conversations.value
  const q = searchQuery.value.toLowerCase()
  return conversations.value.filter((c) =>
    c.otherUser.display_name?.toLowerCase().includes(q) ||
    c.otherUser.username?.toLowerCase().includes(q)
  )
})

function toggle() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    fetchConversations()
  }
}

function isMine(msg) {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(msg.sender_id)
}

// =========================================
// Conversations
// =========================================

async function fetchConversations() {
  if (!auth.activeProfile) return
  loadingConvs.value = conversations.value.length === 0
  const profileId = auth.activeProfile.id
  const allProfileIds = auth.profiles.map((p) => p.id)

  const { data } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
      user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
    `)
    .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
    .order('updated_at', { ascending: false })

  const convs = data || []

  // Fetch last message + unread status for each conversation
  const convIds = convs.map((c) => c.id)
  let lastMessages = []
  let unreadMessages = []

  if (convIds.length > 0) {
    // Get last message per conversation
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, content, image_url, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    // Group by conversation, take first
    const seen = new Set()
    lastMessages = (msgs || []).filter((m) => {
      if (seen.has(m.conversation_id)) return false
      seen.add(m.conversation_id)
      return true
    })

    // Get unread count
    const { data: unreads } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .not('sender_id', 'in', `(${allProfileIds.join(',')})`)
      .eq('read', false)
    unreadMessages = unreads || []
  }

  const lastMsgMap = {}
  lastMessages.forEach((m) => {
    lastMsgMap[m.conversation_id] = m
  })
  const unreadSet = new Set(unreadMessages.map((m) => m.conversation_id))

  conversations.value = convs.map((conv) => {
    const otherUser = conv.user1.id === profileId ? conv.user2 : conv.user1
    const last = lastMsgMap[conv.id]
    return {
      ...conv,
      otherUser,
      lastMessage: last ? (last.content ? (last.content.length > 40 ? last.content.slice(0, 40) + '...' : last.content) : (last.image_url ? '\ud83d\uddbc\ufe0f Image' : null)) : null,
      lastMessageTime: last?.created_at || null,
      hasUnread: unreadSet.has(conv.id),
    }
  })

  unreadCount.value = unreadMessages.length
  loadingConvs.value = false
}

async function fetchUnreadCount() {
  if (!auth.activeProfile) return
  const allProfileIds = auth.profiles.map((p) => p.id)
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .not('sender_id', 'in', `(${allProfileIds.join(',')})`)
    .eq('read', false)
  unreadCount.value = count || 0
}

// =========================================
// Single conversation
// =========================================

async function openConversation(conv) {
  activeConv.value = conv
  await fetchMessages()
  startMsgPolling()
}

function closeConversation() {
  activeConv.value = null
  messages.value = []
  msgContent.value = ''
  removeImage()
  stopMsgPolling()
  fetchConversations()
}

async function fetchMessages() {
  if (!activeConv.value) return
  loadingMessages.value = messages.value.length === 0
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', activeConv.value.id)
    .order('created_at', { ascending: true })
  messages.value = data || []
  loadingMessages.value = false

  // Mark as read
  if (auth.activeProfile) {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', activeConv.value.id)
      .neq('sender_id', auth.activeProfile.id)
      .eq('read', false)
  }

  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function openImageUrl(url) {
  window.open(url, '_blank')
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    alert('Type de fichier non autoris\u00e9. Utilise JPG, PNG, GIF ou WebP.')
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  e.target.value = ''
}

function removeImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = null
  imagePreview.value = null
}

async function handleSend() {
  if (!msgContent.value.trim() && !imageFile.value) return
  if (!activeConv.value) return
  const rateLimitMsg = checkRateLimit('message')
  if (rateLimitMsg) {
    alert(rateLimitMsg)
    return
  }

  let imageUrl = null
  if (imageFile.value) {
    const uploadLimit = checkRateLimit('upload')
    if (uploadLimit) {
      alert(uploadLimit)
      return
    }
    const ext = imageFile.value.name.split('.').pop()
    const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('dm-images')
      .upload(fileName, imageFile.value)
    if (uploadError) {
      alert('Erreur lors de l\'upload de l\'image')
      return
    }
    const { data: urlData } = supabase.storage.from('dm-images').getPublicUrl(fileName)
    imageUrl = urlData.publicUrl
    removeImage()
  }

  const content = msgContent.value.trim()
  msgContent.value = ''

  const insertData = {
    conversation_id: activeConv.value.id,
    sender_id: auth.activeProfile.id,
    content: content || '',
  }
  if (imageUrl) insertData.image_url = imageUrl

  await supabase.from('messages').insert(insertData)
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', activeConv.value.id)

  await fetchMessages()
}

function startMsgPolling() {
  stopMsgPolling()
  msgPollInterval = setInterval(fetchMessages, 5000)
}

function stopMsgPolling() {
  if (msgPollInterval) {
    clearInterval(msgPollInterval)
    msgPollInterval = null
  }
}

// =========================================
// Search / New conversation
// =========================================

function handleSearch() {
  if (!showNewConv.value) return
  clearTimeout(searchTimeout)
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  searching.value = true
  searchTimeout = setTimeout(async () => {
    const term = `%${searchQuery.value.trim()}%`
    const myProfileIds = auth.profiles.map((p) => p.id)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .not('id', 'in', `(${myProfileIds.join(',')})`)
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(10)
    searchResults.value = data || []
    searching.value = false
  }, 300)
}

async function startNewConversation(user) {
  if (!auth.activeProfile) return
  const myId = auth.activeProfile.id
  const [user1, user2] = myId < user.id ? [myId, user.id] : [user.id, myId]

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .maybeSingle()

  let convId
  if (existing) {
    convId = existing.id
  } else {
    const { data: created } = await supabase
      .from('conversations')
      .insert({ user1_id: user1, user2_id: user2 })
      .select('id')
      .single()
    convId = created.id
  }

  // Build conv object and open
  showNewConv.value = false
  searchQuery.value = ''
  searchResults.value = []

  await fetchConversations()
  const conv = conversations.value.find((c) => c.id === convId)
  if (conv) {
    openConversation(conv)
  }
}

// =========================================
// Lifecycle
// =========================================

watch(() => auth.activeProfile?.id, () => {
  if (isExpanded.value) fetchConversations()
  else fetchUnreadCount()
})

onMounted(() => {
  fetchUnreadCount()
  convPollInterval = setInterval(() => {
    if (isExpanded.value && !activeConv.value) {
      fetchConversations()
    } else {
      fetchUnreadCount()
    }
  }, 15000)
})

onUnmounted(() => {
  clearInterval(convPollInterval)
  stopMsgPolling()
})
</script>

<style scoped>
.dm-widget {
  position: fixed;
  bottom: 0;
  left: 20px;
  width: 360px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.35);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-bottom: none;
}

/* Collapsed bar */
.dm-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--bg-secondary);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border);
}

.dm-bar:hover {
  background: var(--bg-hover);
}

.dm-bar-icon {
  font-size: 1.1rem;
}

.dm-bar-title {
  font-weight: 700;
  font-size: 0.95rem;
  flex: 1;
}

.dm-bar-badge {
  background: var(--danger);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.dm-bar-toggle {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

/* Expanded panel */
.dm-panel {
  display: flex;
  flex-direction: column;
  height: 420px;
  background: var(--bg-primary);
}

.dm-widget.conv-open .dm-panel {
  height: 420px;
}

/* Search bar */
.dm-search-bar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.dm-search-bar input {
  flex: 1;
  padding: 0.4rem 0.7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-primary);
  font-size: 0.82rem;
}

.dm-search-bar input:focus {
  outline: none;
  border-color: var(--accent);
}

.dm-new-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

.dm-new-btn:hover {
  background: var(--accent-hover);
}

/* Conversation list */
.dm-conv-list,
.dm-search-results {
  flex: 1;
  overflow-y: auto;
}

.dm-conv-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}

.dm-conv-item:hover {
  background: var(--bg-hover);
}

.dm-conv-item.unread {
  background: rgba(29, 161, 242, 0.06);
}

.dm-conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.dm-conv-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dm-conv-item-name {
  font-weight: 600;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-conv-item-handle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.dm-conv-item-time {
  font-size: 0.72rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.dm-conv-item-preview {
  font-size: 0.8rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

/* Conversation header */
.dm-conv-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.dm-back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;
}

.dm-conv-name {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Messages */
.dm-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dm-bubble {
  max-width: 80%;
  padding: 0.4rem 0.65rem;
  border-radius: 14px;
  align-self: flex-start;
  background: var(--bg-hover);
}

.dm-bubble.mine {
  align-self: flex-end;
  background: var(--accent);
  color: white;
}

.dm-bubble-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
  display: block;
  margin-bottom: 0.2rem;
}

.dm-bubble-image:hover {
  opacity: 0.9;
}

.dm-bubble-text {
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.35;
}

.dm-bubble-time {
  font-size: 0.65rem;
  opacity: 0.6;
  display: block;
  margin-top: 0.1rem;
}

/* Image preview */
.dm-image-preview {
  position: relative;
  margin: 0 0.6rem;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  max-height: 150px;
}

.dm-image-preview img {
  width: 100%;
  max-height: 150px;
  object-fit: cover;
  display: block;
}

.dm-remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.dm-remove-image:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* Message input */
.dm-input {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

.dm-input input {
  flex: 1;
  padding: 0.45rem 0.7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.dm-input input:focus {
  outline: none;
  border-color: var(--accent);
}

.dm-img-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem;
  flex-shrink: 0;
  filter: grayscale(0.3);
}

.dm-img-btn:hover {
  filter: grayscale(0);
}

.dm-send-btn {
  background: var(--accent);
  color: white;
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dm-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Utility */
.dm-loading {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.dm-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.dm-empty-conv {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.82rem;
  margin-top: 2rem;
}

/* Responsive: smaller screens */
@media (max-width: 600px) {
  .dm-widget {
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 12px 12px 0 0;
  }

  .dm-panel {
    height: 50vh;
  }
}
</style>
