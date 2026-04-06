<template>
  <div class="messages-page">
    <!-- Left column: conversation list -->
    <div class="messages-sidebar" :class="{ 'mobile-hidden': activeConvId }">
      <div class="messages-header">
        <h2>Messages</h2>
      </div>

      <NewConversation @created="handleNewConversation" />

      <div v-if="messagesStore.loading && messagesStore.conversations.length === 0" class="loading">
        Chargement...
      </div>
      <ConversationList
        v-else
        :conversations="messagesStore.conversations"
        :activeId="activeConvId"
        @select="openConversation"
        @hide="messagesStore.hideConversation"
      />
    </div>

    <!-- Right column: active conversation or placeholder -->
    <div class="messages-main" :class="{ 'mobile-hidden': !activeConvId }">
      <template v-if="activeConvId">
        <div class="conv-header">
          <button class="back-btn" @click="closeConversation">&larr;</button>
          <UserAvatar
            v-if="activeConvOtherUser"
            :url="activeConvOtherUser.avatar_url"
            :name="activeConvOtherUser.display_name || '?'"
            :size="32"
          />
          <div class="conv-header-info">
            <span class="conv-header-name">{{ activeConvOtherUser?.display_name }}</span>
            <span class="conv-header-handle">@{{ activeConvOtherUser?.username }}</span>
          </div>
        </div>

        <div class="messages-list" ref="messagesContainer">
          <div v-if="loadingMessages" class="loading">Chargement...</div>
          <template v-else>
            <div v-if="messagesStore.currentMessages.length === 0" class="empty-conv">
              D&eacute;but de la conversation
            </div>
            <MessageBubble
              v-for="msg in messagesStore.currentMessages"
              :key="msg.id"
              :message="msg"
              @delete="handleDeleteMessage"
            />
          </template>
        </div>

        <MessageInput @send="handleSend" />
      </template>

      <div v-else class="messages-placeholder">
        <div class="placeholder-content">
          <span class="placeholder-icon">&#x2709;</span>
          <h3>S&eacute;lectionnez une conversation</h3>
          <p>Choisissez une conversation existante ou d&eacute;marrez-en une nouvelle.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessagesStore } from '../stores/messages'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import ConversationList from '../components/ConversationList.vue'
import NewConversation from '../components/NewConversation.vue'
import MessageBubble from '../components/MessageBubble.vue'
import MessageInput from '../components/MessageInput.vue'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const router = useRouter()
const messagesStore = useMessagesStore()
const auth = useAuthStore()

const activeConvId = ref(null)
const activeConvOtherUser = ref(null)
const messagesContainer = ref(null)
const loadingMessages = ref(false)
let pollInterval = null

function openConversation(conv) {
  activeConvId.value = conv.id
  activeConvOtherUser.value = conv.otherUser
  router.replace(`/messages/${conv.id}`)
  loadMessages()
}

function closeConversation() {
  activeConvId.value = null
  activeConvOtherUser.value = null
  clearInterval(pollInterval)
  pollInterval = null
  router.replace('/messages')
}

async function loadMessages() {
  loadingMessages.value = true
  await messagesStore.fetchMessages(activeConvId.value)
  await messagesStore.markAsRead(activeConvId.value)
  loadingMessages.value = false
  scrollToBottom()

  // Start polling
  clearInterval(pollInterval)
  pollInterval = setInterval(async () => {
    if (!activeConvId.value) return
    await messagesStore.fetchMessages(activeConvId.value)
    await messagesStore.markAsRead(activeConvId.value)
    scrollToBottom()
  }, 8000)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSend({ content, imageFile }) {
  let imageUrl = null
  if (imageFile) {
    const ext = imageFile.name.split('.').pop()
    const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('dm-images').upload(fileName, imageFile)
    if (uploadError) { alert('Erreur upload'); return }
    const { data: urlData } = supabase.storage.from('dm-images').getPublicUrl(fileName)
    imageUrl = urlData.publicUrl
  }
  await messagesStore.sendMessage(activeConvId.value, content, imageUrl)
  await messagesStore.fetchMessages(activeConvId.value)
  scrollToBottom()
  // Refresh conversation list to update last message
  messagesStore.fetchConversations()
  // Notify DmWidget
  window.dispatchEvent(new CustomEvent('dm-message-sent', { detail: { conversationId: activeConvId.value } }))
}

async function handleDeleteMessage(messageId) {
  await messagesStore.deleteMessage(messageId)
}

async function handleNewConversation(conversationId) {
  await messagesStore.fetchConversations()
  const conv = messagesStore.conversations.find((c) => c.id === conversationId)
  if (conv) openConversation(conv)
}

// Handle initial load with route param
async function initFromRoute() {
  await messagesStore.fetchConversations()
  if (route.params.id) {
    const conv = messagesStore.conversations.find((c) => c.id === route.params.id)
    if (conv) {
      openConversation(conv)
    } else {
      // Conv not in list — load it directly
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
          user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', route.params.id)
        .single()
      if (data) {
        const myProfileIds = auth.profiles.map((p) => p.id)
        const otherUser = myProfileIds.includes(data.user1.id) ? data.user2 : data.user1
        activeConvId.value = data.id
        activeConvOtherUser.value = otherUser
        loadMessages()
      }
    }
  }
}

// Watch for route changes (e.g. navigating from /messages to /messages/:id)
watch(() => route.params.id, (newId) => {
  if (!newId && activeConvId.value) {
    closeConversation()
  }
})

let convPollInterval = null

function onExternalMessageSent(e) {
  const convId = e.detail?.conversationId
  // Refresh conversation list
  messagesStore.fetchConversations()
  // If viewing the same conversation, refresh messages
  if (activeConvId.value && activeConvId.value === convId) {
    messagesStore.fetchMessages(activeConvId.value).then(() => scrollToBottom())
  }
}

function onExternalReadUpdate() {
  messagesStore.fetchConversations()
}

onMounted(() => {
  initFromRoute()
  // Poll conversation list every 20s
  convPollInterval = setInterval(() => {
    messagesStore.fetchConversations()
  }, 20000)
  window.addEventListener('dm-message-sent', onExternalMessageSent)
  window.addEventListener('dm-read-update', onExternalReadUpdate)
})

onUnmounted(() => {
  clearInterval(pollInterval)
  clearInterval(convPollInterval)
  window.removeEventListener('dm-message-sent', onExternalMessageSent)
  window.removeEventListener('dm-read-update', onExternalReadUpdate)
})
</script>

<style scoped>
.messages-page {
  display: flex;
  height: calc(100vh - var(--header-height));
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

/* ---- Left sidebar ---- */
.messages-sidebar {
  width: 350px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.messages-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.messages-header h2 {
  font-size: 1.2rem;
  margin: 0;
  font-weight: 800;
}

/* ---- Right main ---- */
.messages-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.conv-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.back-btn {
  display: none;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.2rem;
}

.conv-header-info {
  display: flex;
  flex-direction: column;
}

.conv-header-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.conv-header-handle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty-conv {
  text-align: center;
  color: var(--text-secondary);
  margin-top: 2rem;
  font-size: 0.9rem;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

/* ---- Placeholder ---- */
.messages-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-content {
  text-align: center;
  color: var(--text-secondary);
}

.placeholder-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.75rem;
  opacity: 0.4;
}

.placeholder-content h3 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 700;
}

.placeholder-content p {
  margin: 0;
  font-size: 0.88rem;
}

/* ---- Mobile ---- */
@media (max-width: 768px) {
  .messages-page {
    height: calc(100vh - var(--header-height) - var(--mobile-nav-height));
  }

  .messages-sidebar {
    width: 100%;
    border-right: none;
  }

  .messages-main {
    width: 100%;
  }

  .mobile-hidden {
    display: none !important;
  }

  .back-btn {
    display: block;
  }
}
</style>
