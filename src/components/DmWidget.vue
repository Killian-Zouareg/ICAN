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
              class="dm-bubble"
              :class="{ mine: isMine(msg) }"
            >
              <!-- Sender name in group chats -->
              <span v-if="activeConv.is_group && !isMine(msg)" class="dm-bubble-sender">
                {{ getSenderName(msg.sender_id) }}
              </span>
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

  // Fetch 1-on-1 conversations
  const { data: dmData } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
      user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('is_group', false)
    .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
    .order('updated_at', { ascending: false })

  // Fetch group conversations via membership
  const { data: myMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .in('profile_id', allProfileIds)

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

  // Merge all conversations
  const allConvs = [
    ...(dmData || []).map((conv) => ({
      ...conv,
      otherUser: conv.user1.id === profileId ? conv.user2 : conv.user1,
      displayName: (conv.user1.id === profileId ? conv.user2 : conv.user1).display_name,
    })),
    ...groupConvs.map((conv) => ({
      ...conv,
      displayName: conv.group_name || 'Groupe',
    })),
  ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

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
      .not('sender_id', 'in', `(${allProfileIds.join(',')})`)
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
    const allProfileIds = auth.profiles.map((p) => p.id)
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .not('sender_id', 'in', `(${allProfileIds.join(',')})`)
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
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', activeConv.value.id)
    .order('created_at', { ascending: true })
  messages.value = data || []
  loadingMessages.value = false

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
    const ext = imageFile.value.name.split('.').pop()
    const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('dm-images').upload(fileName, imageFile.value)
    if (uploadError) { alert('Erreur upload'); return }
    const { data: urlData } = supabase.storage.from('dm-images').getPublicUrl(fileName)
    imageUrl = urlData.publicUrl
    removeImage()
  }

  const content = msgContent.value.trim()
  msgContent.value = ''
  const insertData = { conversation_id: activeConv.value.id, sender_id: auth.activeProfile.id, content: content || '' }
  if (imageUrl) insertData.image_url = imageUrl

  await supabase.from('messages').insert(insertData)
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.value.id)
  await fetchMessages()
}

function startMsgPolling() { stopMsgPolling(); msgPollInterval = setInterval(fetchMessages, 5000) }
function stopMsgPolling() { if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null } }

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

onMounted(() => {
  fetchUnreadCount()
  convPollInterval = setInterval(() => {
    if (isExpanded.value && !activeConv.value) fetchConversations()
    else fetchUnreadCount()
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
  right: 20px;
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
.dm-bar:hover { background: var(--bg-hover); }
.dm-bar-icon { font-size: 1.1rem; }
.dm-bar-title { font-weight: 700; font-size: 0.95rem; flex: 1; }
.dm-bar-badge { background: var(--danger); color: white; font-size: 0.7rem; font-weight: 600; padding: 1px 6px; border-radius: 10px; min-width: 18px; text-align: center; }
.dm-bar-toggle { font-size: 0.65rem; color: var(--text-secondary); }

.dm-panel {
  display: flex;
  flex-direction: column;
  height: 420px;
  background: var(--bg-primary);
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
.dm-search-bar input:focus { outline: none; border-color: var(--accent); }

.dm-new-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent); color: white; border: none;
  font-size: 1.2rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; line-height: 1;
}
.dm-new-btn:hover { background: var(--accent-hover); }

/* New conv menu */
.dm-new-menu {
  border-bottom: 1px solid var(--border);
}

/* Conv list */
.dm-conv-list, .dm-search-results, .dm-new-menu { flex: 1; overflow-y: auto; }
.dm-conv-list.with-menu { border-top: 0; }

.dm-conv-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: background 0.12s;
}
.dm-conv-item:hover { background: var(--bg-hover); }
.dm-conv-item.unread { background: rgba(29, 161, 242, 0.06); }

.dm-conv-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.dm-conv-item-top { display: flex; align-items: center; justify-content: space-between; }
.dm-conv-item-name { font-weight: 600; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-conv-item-handle { font-size: 0.78rem; color: var(--text-secondary); }
.dm-conv-item-time { font-size: 0.72rem; color: var(--text-secondary); flex-shrink: 0; }
.dm-conv-item-preview { font-size: 0.8rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

/* Group avatar */
.dm-group-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--bg-hover); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; flex-shrink: 0;
}
.dm-group-avatar.small { width: 32px; height: 32px; font-size: 0.9rem; }

/* Conv header */
.dm-conv-header {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}
.dm-back-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 1rem; padding: 0.2rem; }
.dm-conv-name { font-weight: 600; font-size: 0.9rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-member-count {
  font-size: 0.7rem; background: var(--bg-hover); color: var(--text-secondary);
  padding: 1px 6px; border-radius: 8px; flex-shrink: 0;
}

/* Messages */
.dm-messages { flex: 1; overflow-y: auto; padding: 0.6rem; display: flex; flex-direction: column; gap: 0.2rem; }
.dm-bubble { max-width: 80%; padding: 0.4rem 0.65rem; border-radius: 14px; align-self: flex-start; background: var(--bg-hover); }
.dm-bubble.mine { align-self: flex-end; background: var(--accent); color: white; }
.dm-bubble-sender { font-size: 0.7rem; font-weight: 600; color: var(--accent); display: block; margin-bottom: 0.1rem; }
.dm-bubble.mine .dm-bubble-sender { color: rgba(255,255,255,0.7); }
.dm-bubble-image { max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer; display: block; margin-bottom: 0.2rem; }
.dm-bubble-image:hover { opacity: 0.9; }
.dm-bubble-text { font-size: 0.85rem; white-space: pre-wrap; word-break: break-word; line-height: 1.35; }
.dm-bubble-time { font-size: 0.65rem; opacity: 0.6; display: block; margin-top: 0.1rem; }

/* Image preview */
.dm-image-preview { position: relative; margin: 0 0.6rem; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); max-height: 150px; }
.dm-image-preview img { width: 100%; max-height: 150px; object-fit: cover; display: block; }
.dm-remove-image { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
.dm-remove-image:hover { background: rgba(0,0,0,0.9); }

/* Input */
.dm-input { display: flex; gap: 0.4rem; padding: 0.5rem 0.6rem; border-top: 1px solid var(--border); background: var(--bg-secondary); }
.dm-input input { flex: 1; padding: 0.45rem 0.7rem; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 16px; color: var(--text-primary); font-size: 0.85rem; }
.dm-input input:focus { outline: none; border-color: var(--accent); }
.dm-img-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0.2rem; flex-shrink: 0; filter: grayscale(0.3); }
.dm-img-btn:hover { filter: grayscale(0); }
.dm-send-btn { background: var(--accent); color: white; border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dm-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Create group */
.dm-create-group {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dm-group-name-input {
  width: 100%;
  padding: 0.5rem 0.7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.9rem;
}
.dm-group-name-input:focus { outline: none; border-color: var(--accent); }

.dm-group-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.dm-group-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  width: 100%;
  margin-bottom: 0.1rem;
}

.dm-group-chip {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.2rem 0.5rem;
  font-size: 0.78rem;
}

.dm-group-chip button {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  line-height: 1;
}
.dm-group-chip button:hover { color: var(--danger); }

.dm-group-search input {
  width: 100%;
  padding: 0.4rem 0.7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-primary);
  font-size: 0.82rem;
}
.dm-group-search input:focus { outline: none; border-color: var(--accent); }

.dm-group-results { flex: 1; overflow-y: auto; }

.dm-create-group-btn {
  width: 100%;
  padding: 0.6rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: auto;
}
.dm-create-group-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dm-create-group-btn:hover:not(:disabled) { background: var(--accent-hover); }

/* Utility */
.dm-loading { padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.82rem; }
.dm-empty { padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.85rem; }
.dm-empty-conv { text-align: center; color: var(--text-secondary); font-size: 0.82rem; margin-top: 2rem; }

@media (max-width: 600px) {
  .dm-widget { left: 0; right: 0; width: 100%; border-radius: 12px 12px 0 0; }
  .dm-panel { height: 50vh; }
}
</style>
