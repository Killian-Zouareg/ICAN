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
          <button class="back-btn" @click="closeConversation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <router-link
            v-if="activeConvOtherUser"
            :to="`/user/${activeConvOtherUser.username}`"
            class="conv-header-link"
          >
            <UserAvatar
              :url="activeConvOtherUser.avatar_url"
              :name="activeConvOtherUser.display_name || '?'"
              :size="36"
            />
            <div class="conv-header-info">
              <span class="conv-header-name">{{ activeConvOtherUser?.display_name }}</span>
              <span class="conv-header-handle">@{{ activeConvOtherUser?.username }}</span>
            </div>
          </router-link>
        </div>

        <div class="messages-list" ref="messagesContainer">
          <div v-if="loadingMessages" class="loading">
            <div class="loading-spinner"></div>
            Chargement...
          </div>
          <template v-else>
            <div v-if="messagesStore.currentMessages.length === 0" class="empty-conv">
              <div class="empty-conv-icon">&#x2709;</div>
              <p>D&eacute;but de la conversation avec <strong>{{ activeConvOtherUser?.display_name }}</strong></p>
              <span>Envoyez votre premier message !</span>
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
          <div class="placeholder-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
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

<style scoped src="./MessagesView.css"></style>
