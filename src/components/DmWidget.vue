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

      <!-- ============ CONVERSATION VIEW ============ -->
      <template v-if="activeConv">
        <div class="dm-conv-header">
          <button class="dm-back-btn" @click="closeConversation">&larr;</button>
          <template v-if="activeConv.is_group">
            <div class="dm-group-avatar">&#x1F465;</div>
            <span class="dm-conv-name">{{ activeConv.group_name || 'Groupe' }}</span>
            <span class="dm-member-count">{{ activeConv.members?.length || 0 }}</span>
          </template>
          <template v-else>
            <UserAvatar
              v-if="activeConv.otherUser"
              :url="activeConv.otherUser.avatar_url"
              :name="activeConv.otherUser.display_name || '?'"
              :size="24"
            />
            <span class="dm-conv-name">{{ activeConv.otherUser?.display_name }}</span>
          </template>
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
              class="dm-bubble-row"
              :class="{ mine: isMine(msg) }"
            >
              <div v-if="!msg.deleted_for_everyone" class="dm-bubble-actions">
                <button class="dm-action-btn" @click="setReply(msg)" title="Répondre">↩</button>
                <button
                  v-if="isMine(msg)"
                  class="dm-action-btn dm-delete"
                  @click="deleteMsg(msg.id)"
                  title="Supprimer"
                >🗑</button>
              </div>
              <div
                class="dm-bubble"
                :class="{ mine: isMine(msg), deleted: msg.deleted_for_everyone }"
              >
                <span v-if="activeConv.is_group && !isMine(msg) && !msg.deleted_for_everyone" class="dm-bubble-sender">
                  {{ getSenderName(msg.sender_id) }}
                </span>
                <div v-if="msg.parent_message_id && msg.parent && !msg.deleted_for_everyone" class="dm-quoted">
                  <span class="dm-quoted-author">{{ msg.parent.sender?.display_name || '?' }}</span>
                  <span class="dm-quoted-content">{{ getParentPreview(msg.parent) }}</span>
                </div>
                <p v-if="msg.deleted_for_everyone" class="dm-bubble-text dm-tombstone">
                  🚫 Message supprimé
                </p>
                <template v-else>
                  <img
                    v-if="msg.image_url"
                    :src="msg.image_url"
                    alt="Image"
                    class="dm-bubble-image"
                    @click="openImageUrl(msg.image_url)"
                  />
                  <p v-if="msg.content" class="dm-bubble-text">{{ msg.content }}</p>
                </template>
                <span class="dm-bubble-time">{{ timeAgo(msg.created_at) }}</span>
              </div>
            </div>
          </template>
        </div>

        <div v-if="replyingTo" class="dm-reply-banner">
          <div class="dm-reply-info">
            <span class="dm-reply-label">Réponse à <strong>{{ replyingTo.sender?.display_name || getSenderName(replyingTo.sender_id) || '?' }}</strong></span>
            <span class="dm-reply-preview">{{ getReplyPreview(replyingTo) }}</span>
          </div>
          <button class="dm-reply-cancel" @click="replyingTo = null">&times;</button>
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

      <!-- ============ CREATE GROUP VIEW ============ -->
      <template v-else-if="showCreateGroup">
        <div class="dm-conv-header">
          <button class="dm-back-btn" @click="cancelCreateGroup">&larr;</button>
          <span class="dm-conv-name">Nouveau groupe</span>
        </div>
        <div class="dm-create-group">
          <input
            v-model="groupName"
            type="text"
            placeholder="Nom du groupe..."
            maxlength="50"
            class="dm-group-name-input"
          />
          <div class="dm-group-selected">
            <span class="dm-group-label">Membres ({{ selectedMembers.length }}) :</span>
            <div v-for="m in selectedMembers" :key="m.id" class="dm-group-chip">
              <span>{{ m.display_name }}</span>
              <button @click="removeMember(m.id)">&times;</button>
            </div>
          </div>
          <div class="dm-group-search">
            <input
              v-model="groupSearchQuery"
              type="text"
              placeholder="Ajouter des membres..."
              @input="searchGroupMembers"
            />
          </div>
          <div class="dm-group-results">
            <div v-if="groupSearching" class="dm-loading">Recherche...</div>
            <div
              v-for="u in groupSearchResults"
              :key="u.id"
              class="dm-conv-item"
              @click="addMember(u)"
            >
              <UserAvatar :url="u.avatar_url" :name="u.display_name || u.username || '?'" :size="28" />
              <div class="dm-conv-info">
                <span class="dm-conv-item-name">{{ u.display_name }}</span>
                <span class="dm-conv-item-handle">@{{ u.username }}</span>
              </div>
            </div>
          </div>
          <button
            class="dm-create-group-btn"
            :disabled="selectedMembers.length < 2 || !groupName.trim()"
            @click="createGroup"
          >
            Cr&eacute;er le groupe ({{ selectedMembers.length }} membres)
          </button>
        </div>
      </template>

      <!-- ============ CONVERSATION LIST ============ -->
      <template v-else>
        <div class="dm-search-bar">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="showNewConv ? 'Rechercher un utilisateur...' : 'Rechercher une conversation...'"
            @input="handleSearch"
          />
          <button class="dm-new-btn" @click="toggleNewConv" :title="showNewConv ? 'Annuler' : 'Nouveau message'">
            {{ showNewConv ? '&times;' : '+' }}
          </button>
        </div>

        <!-- New conv menu -->
        <div v-if="showNewConv && !searchQuery.trim()" class="dm-new-menu">
          <div class="dm-conv-item" @click="startCreateGroup">
            <div class="dm-group-avatar small">&#x1F465;</div>
            <div class="dm-conv-info">
              <span class="dm-conv-item-name">Cr&eacute;er un groupe</span>
              <span class="dm-conv-item-handle">Discussion &agrave; plusieurs</span>
            </div>
          </div>
        </div>

        <!-- User search results for new 1-on-1 -->
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
        <div v-if="!showNewConv || (!searchQuery.trim() && showNewConv)" class="dm-conv-list" :class="{ 'with-menu': showNewConv }">
          <div v-if="loadingConvs" class="dm-loading">Chargement...</div>
          <div v-else-if="filteredConversations.length === 0 && !showNewConv" class="dm-empty">
            Aucune conversation
          </div>
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="dm-conv-item"
            :class="{ unread: conv.hasUnread }"
            @click="openConversation(conv)"
          >
            <template v-if="conv.is_group">
              <div class="dm-group-avatar">&#x1F465;</div>
            </template>
            <template v-else>
              <UserAvatar
                :url="conv.otherUser?.avatar_url"
                :name="conv.otherUser?.display_name || '?'"
                :size="36"
              />
            </template>
            <div class="dm-conv-info">
              <div class="dm-conv-item-top">
                <span class="dm-conv-item-name">{{ conv.displayName }}</span>
                <span class="dm-conv-item-time">{{ conv.lastMessageTime ? timeAgo(conv.lastMessageTime) : '' }}</span>
              </div>
              <span class="dm-conv-item-preview">{{ conv.lastMessage || 'Nouvelle conversation' }}</span>
            </div>
            <span v-if="conv.hasUnread" class="dm-unread-dot"></span>
            <button
              class="dm-hide-btn"
              @click.stop="hideConv(conv.id)"
              title="Masquer"
            >&times;</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/time'
import { checkRateLimit } from '../lib/rateLimit'
import { compressImage } from '../lib/imageCompress'
import UserAvatar from './UserAvatar.vue'
import { useRealtimeSubscription } from '../composables/useRealtimeSubscription'

const auth = useAuthStore()
const messagesStore = useMessagesStore()

async function hideConv(convId) {
  await messagesStore.hideConversation(convId)
  conversations.value = conversations.value.filter((c) => c.id !== convId)
}

const isExpanded = ref(false)
const activeConv = ref(null)
const messages = ref([])
const msgContent = ref('')
const messagesContainer = ref(null)
const loadingMessages = ref(false)
const loadingConvs = ref(false)
const replyingTo = ref(null)

// Image upload
const imageFile = ref(null)
const imagePreview = ref(null)
const fileInputRef = ref(null)

const conversations = ref([])
const unreadCount = ref(0)

// Search / new conv
const searchQuery = ref('')
const showNewConv = ref(false)
const searchResults = ref([])
const searching = ref(false)
let searchTimeout = null

// Create group
const showCreateGroup = ref(false)
const groupName = ref('')
const selectedMembers = ref([])
const groupSearchQuery = ref('')
const groupSearchResults = ref([])
const groupSearching = ref(false)
let groupSearchTimeout = null

// Polling
let convPollInterval = null
let msgPollInterval = null

// Realtime for conversation list (new messages from others)
const { subscribe: subscribeDmConvList } = useRealtimeSubscription('dm-conv-list', [
  { event: 'INSERT', table: 'messages', callback: () => {
      fetchConversations()
      fetchUnreadCount()
      window.dispatchEvent(new CustomEvent('dm-message-received'))
  } },
])

// Members cache for group sender names
const membersCache = ref({})

const barTitle = computed(() => {
  if (activeConv.value) {
    if (activeConv.value.is_group) return activeConv.value.group_name || 'Groupe'
    return activeConv.value.otherUser?.display_name || 'Messages'
  }
  return 'Messages'
})

const filteredConversations = computed(() => {
  if (!searchQuery.value.trim() || showNewConv.value) return conversations.value
  const q = searchQuery.value.toLowerCase()
  return conversations.value.filter((c) =>
    c.displayName?.toLowerCase().includes(q)
  )
})

function toggle() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) fetchConversations()
}

function toggleNewConv() {
  showNewConv.value = !showNewConv.value
  if (!showNewConv.value) {
    searchQuery.value = ''
    searchResults.value = []
  }
}

function isMine(msg) {
  const myProfileIds = auth.profiles.map((p) => p.id)
  return myProfileIds.includes(msg.sender_id)
}

function getSenderName(senderId) {
  const member = membersCache.value[senderId]
  return member?.display_name || '?'
}

// =========================================
// Conversations list
// =========================================

async function fetchConversations() {
  if (!auth.activeProfile) return
  try {
  loadingConvs.value = conversations.value.length === 0
  const profileId = auth.activeProfile.id
  const allProfileIds = auth.profiles.map((p) => p.id)

  // Fetch 1-on-1 conversations for the active profile only (strict isolation)
  const { data: dmData } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
      user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
    `)
    .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
    .order('updated_at', { ascending: false })
    .limit(50)

  // Fetch group conversations via membership (active profile only)
  const { data: myMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', profileId)

  let groupConvs = []
  if (myMemberships && myMemberships.length > 0) {
    const groupIds = [...new Set(myMemberships.map((m) => m.conversation_id))]
    const { data: groups } = await supabase
      .from('conversations')
      .select('*')
      .eq('is_group', true)
      .in('id', groupIds)
      .order('updated_at', { ascending: false })
    groupConvs = groups || []

    // Fetch members for each group
    if (groupConvs.length > 0) {
      const { data: allMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id, profile_id, profiles(id, username, display_name, avatar_url)')
        .in('conversation_id', groupConvs.map((g) => g.id))

      const membersByConv = {}
      ;(allMembers || []).forEach((m) => {
        if (!membersByConv[m.conversation_id]) membersByConv[m.conversation_id] = []
        membersByConv[m.conversation_id].push(m.profiles)
        // Cache for sender name lookup
        membersCache.value[m.profiles.id] = m.profiles
      })
      groupConvs = groupConvs.map((g) => ({
        ...g,
        members: membersByConv[g.id] || [],
      }))
    }
  }

  // Fetch hidden conversation IDs from DB
  const { data: hiddenData } = await supabase
    .from('conversation_hidden')
    .select('conversation_id')
    .eq('profile_id', profileId)
  const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id))

  // Merge all conversations (excluding hidden)
  const allConvs = [
    ...(dmData || []).map((conv) => ({
      ...conv,
      otherUser: conv.user1?.id === profileId ? conv.user2 : conv.user1,
      displayName: (conv.user1?.id === profileId ? conv.user2 : conv.user1)?.display_name || '?',
    })),
    ...groupConvs.map((conv) => ({
      ...conv,
      displayName: conv.group_name || 'Groupe',
    })),
  ]
    .filter((c) => !hiddenIds.has(c.id))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

  // Fetch last messages + unread
  const convIds = allConvs.map((c) => c.id)
  let lastMessages = []
  let unreadMessages = []

  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, content, image_url, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    const seen = new Set()
    lastMessages = (msgs || []).filter((m) => {
      if (seen.has(m.conversation_id)) return false
      seen.add(m.conversation_id)
      return true
    })

    const { data: unreads } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', profileId)
      .eq('read', false)
    unreadMessages = unreads || []
  }

  const lastMsgMap = {}
  lastMessages.forEach((m) => { lastMsgMap[m.conversation_id] = m })
  const unreadSet = new Set(unreadMessages.map((m) => m.conversation_id))

  conversations.value = allConvs.map((conv) => {
    const last = lastMsgMap[conv.id]
    return {
      ...conv,
      lastMessage: last
        ? (last.content
          ? (last.content.length > 40 ? last.content.slice(0, 40) + '...' : last.content)
          : (last.image_url ? '\ud83d\uddbc\ufe0f Image' : null))
        : null,
      lastMessageTime: last?.created_at || null,
      hasUnread: unreadSet.has(conv.id),
    }
  })

  unreadCount.value = unreadMessages.length
  loadingConvs.value = false
  } catch {
    loadingConvs.value = false
  }
}

async function fetchUnreadCount() {
  if (!auth.activeProfile) return
  try {
    const profileId = auth.activeProfile.id
    const allProfileIds = auth.profiles.map((p) => p.id)

    // Match conversations for the active profile only (per-profile isolation)
    const { data: dmConvs } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)

    const { data: groupConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('profile_id', profileId)

    const convIds = [
      ...(dmConvs || []).map((c) => c.id),
      ...(groupConvs || []).map((c) => c.conversation_id),
    ]

    if (convIds.length === 0) {
      unreadCount.value = 0
      return
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', profileId)
      .eq('read', false)
    if (!error) unreadCount.value = count || 0
  } catch {
    // Silently ignore — polling will retry
  }
}

// =========================================
// Single conversation
// =========================================

async function openConversation(conv) {
  activeConv.value = conv
  // For groups, also cache member profiles
  if (conv.is_group && conv.members) {
    conv.members.forEach((m) => { membersCache.value[m.id] = m })
  }
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
  const prevCount = messages.value.length
  const wasAtBottom = isNearBottom()
  const { data } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url),
      parent:messages!messages_parent_message_id_fkey(
        id, content, sender_id, deleted_for_everyone,
        sender:profiles!messages_sender_id_fkey(id, username, display_name)
      )
    `)
    .eq('conversation_id', activeConv.value.id)
    .order('created_at', { ascending: true })

  const newData = data || []
  // Smart merge: patch in place if same set of IDs (preserves scroll/DOM)
  let sameSet = messages.value.length === newData.length
  if (sameSet) {
    for (let i = 0; i < newData.length; i++) {
      if (messages.value[i].id !== newData[i].id) { sameSet = false; break }
    }
  }
  if (sameSet && newData.length > 0) {
    for (let i = 0; i < newData.length; i++) {
      Object.assign(messages.value[i], newData[i])
    }
  } else {
    messages.value = newData
  }
  loadingMessages.value = false

  if (auth.activeProfile) {
    const { data: markedRows } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', activeConv.value.id)
      .neq('sender_id', auth.activeProfile.id)
      .eq('read', false)
      .select('id')
    if (markedRows && markedRows.length > 0) {
      window.dispatchEvent(new Event('dm-read-update'))
    }
  }

  // Scroll only on first load, or when new messages arrive AND user was already near bottom
  if (prevCount === 0) {
    scrollToBottom()
  } else if (messages.value.length > prevCount && wasAtBottom) {
    scrollToBottom()
  }
}

function isNearBottom() {
  const el = messagesContainer.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// =========================================
// Send message
// =========================================

function openImageUrl(url) { window.open(url, '_blank') }
function triggerFileInput() { fileInputRef.value?.click() }

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { alert('Image trop lourde (max 5 Mo)'); return }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) { alert('Type non autoris\u00e9'); return }
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
  const rl = checkRateLimit('message')
  if (rl) { alert(rl); return }

  let imageUrl = null
  if (imageFile.value) {
    const ul = checkRateLimit('upload')
    if (ul) { alert(ul); return }
    const compressed = await compressImage(imageFile.value)
    const ext = (compressed.name || imageFile.value.name).split('.').pop()
    const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('dm-images').upload(fileName, compressed)
    if (uploadError) { alert('Erreur upload'); return }
    const { data: urlData } = supabase.storage.from('dm-images').getPublicUrl(fileName)
    imageUrl = urlData.publicUrl
    removeImage()
  }

  const content = msgContent.value.trim()
  msgContent.value = ''
  const insertData = { conversation_id: activeConv.value.id, sender_id: auth.activeProfile.id, content: content || '' }
  if (imageUrl) insertData.image_url = imageUrl
  if (replyingTo.value?.id) insertData.parent_message_id = replyingTo.value.id

  await supabase.from('messages').insert(insertData)
  replyingTo.value = null
  await messagesStore.unhideConversation(activeConv.value.id)
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.value.id)
  await fetchMessages()
  window.dispatchEvent(new CustomEvent('dm-message-sent', { detail: { conversationId: activeConv.value.id } }))
}

function setReply(msg) {
  if (msg.deleted_for_everyone) return
  replyingTo.value = msg
}

async function deleteMsg(messageId) {
  if (!confirm('Supprimer ce message pour tout le monde ?')) return
  try {
    await messagesStore.deleteMessage(messageId)
    await fetchMessages()
  } catch (e) {
    alert('Erreur : ' + (e.message || ''))
  }
}

function getParentPreview(parent) {
  if (!parent) return ''
  if (parent.deleted_for_everyone) return 'Message supprimé'
  const c = parent.content || ''
  if (!c) return '🖼️ Image'
  return c.length > 60 ? c.slice(0, 60) + '...' : c
}

function getReplyPreview(msg) {
  if (!msg) return ''
  const c = msg.content || ''
  if (!c) return msg.image_url ? '🖼️ Image' : ''
  return c.length > 50 ? c.slice(0, 50) + '...' : c
}

let dmRealtimeSub = null

function setupDmRealtime(conversationId) {
  teardownDmRealtime()
  const { subscribe, unsubscribe } = useRealtimeSubscription(
    'dm-widget-' + conversationId,
    [{
      event: 'INSERT',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: async (payload) => {
        if (payload.new.sender_id === auth.activeProfile?.id) return
        await fetchMessages()
      },
    },
    {
      event: 'UPDATE',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: async () => {
        // Reflect soft-deletes / read status changes
        await fetchMessages()
      },
    }]
  )
  dmRealtimeSub = { unsubscribe }
  subscribe()
}

function teardownDmRealtime() {
  if (dmRealtimeSub) { dmRealtimeSub.unsubscribe(); dmRealtimeSub = null }
}

function startMsgPolling() { stopMsgPolling(); setupDmRealtime(activeConv.value?.id) }
function stopMsgPolling() { if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null }; teardownDmRealtime() }

// =========================================
// Search / New 1-on-1 conversation
// =========================================

function handleSearch() {
  if (!showNewConv.value) return
  clearTimeout(searchTimeout)
  if (!searchQuery.value.trim()) { searchResults.value = []; return }
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
    .from('conversations').select('id').eq('user1_id', user1).eq('user2_id', user2).eq('is_group', false).maybeSingle()

  let convId
  if (existing) { convId = existing.id }
  else {
    const { data: created } = await supabase
      .from('conversations').insert({ user1_id: user1, user2_id: user2, is_group: false }).select('id').single()
    convId = created.id
  }

  // Unhide in case conversation was previously hidden
  await messagesStore.unhideConversation(convId)

  showNewConv.value = false
  searchQuery.value = ''
  searchResults.value = []
  await fetchConversations()
  const conv = conversations.value.find((c) => c.id === convId)
  if (conv) openConversation(conv)
}

// =========================================
// Create group
// =========================================

function startCreateGroup() {
  showNewConv.value = false
  showCreateGroup.value = true
  groupName.value = ''
  selectedMembers.value = []
  groupSearchQuery.value = ''
  groupSearchResults.value = []
}

function cancelCreateGroup() {
  showCreateGroup.value = false
}

function addMember(user) {
  if (selectedMembers.value.some((m) => m.id === user.id)) return
  selectedMembers.value.push(user)
  groupSearchQuery.value = ''
  groupSearchResults.value = []
}

function removeMember(userId) {
  selectedMembers.value = selectedMembers.value.filter((m) => m.id !== userId)
}

function searchGroupMembers() {
  clearTimeout(groupSearchTimeout)
  if (!groupSearchQuery.value.trim()) { groupSearchResults.value = []; return }
  groupSearching.value = true
  groupSearchTimeout = setTimeout(async () => {
    const term = `%${groupSearchQuery.value.trim()}%`
    const myProfileIds = auth.profiles.map((p) => p.id)
    const alreadySelected = selectedMembers.value.map((m) => m.id)
    const excludeIds = [...myProfileIds, ...alreadySelected]
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(10)
    groupSearchResults.value = data || []
    groupSearching.value = false
  }, 300)
}

async function createGroup() {
  if (!auth.activeProfile || selectedMembers.value.length < 2 || !groupName.value.trim()) return

  const memberIds = [auth.activeProfile.id, ...selectedMembers.value.map((m) => m.id)]
  const { data: convId, error } = await supabase.rpc('create_group_conversation', {
    p_group_name: groupName.value.trim(),
    p_member_ids: memberIds,
  })

  if (error) { alert('Erreur lors de la création du groupe'); console.error(error); return }

  showCreateGroup.value = false
  await fetchConversations()
  const created = conversations.value.find((c) => c.id === convId)
  if (created) openConversation(created)
}

// =========================================
// Lifecycle
// =========================================

watch(() => auth.activeProfile?.id, () => {
  if (isExpanded.value) fetchConversations()
  else fetchUnreadCount()
})

function onExternalMessageSent(e) {
  const convId = e.detail?.conversationId
  // Refresh conversations list (last message, unread status)
  if (isExpanded.value && !activeConv.value) fetchConversations()
  else fetchUnreadCount()
  // If we're viewing the same conversation, refresh messages
  if (activeConv.value && activeConv.value.id === convId) fetchMessages()
}

function onExternalReadUpdate() {
  if (isExpanded.value && !activeConv.value) fetchConversations()
  else fetchUnreadCount()
}

onMounted(() => {
  fetchUnreadCount()
  subscribeDmConvList()
  window.addEventListener('dm-message-sent', onExternalMessageSent)
  window.addEventListener('dm-read-update', onExternalReadUpdate)
})

onUnmounted(() => {
  clearInterval(convPollInterval)
  stopMsgPolling()
  window.removeEventListener('dm-message-sent', onExternalMessageSent)
  window.removeEventListener('dm-read-update', onExternalReadUpdate)
})
</script>

<style scoped src="./DmWidget.css"></style>
