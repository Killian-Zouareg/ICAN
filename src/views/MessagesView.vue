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

          <!-- Group header -->
          <template v-if="activeConv?.is_group">
            <div class="conv-header-link" @click="showGroupModal = true" style="cursor: pointer">
              <div class="conv-group-avatar">&#x1F465;</div>
              <div class="conv-header-info">
                <span class="conv-header-name">{{ activeConv.group_name || 'Groupe' }}</span>
                <span class="conv-header-handle">{{ activeConv.members?.length || 0 }} membres</span>
              </div>
            </div>
            <button class="header-action-btn" @click="showGroupModal = true" title="Gérer le groupe">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </template>

          <!-- 1-on-1 header -->
          <router-link
            v-else-if="activeConv?.otherUser"
            :to="`/user/${activeConv.otherUser.username}`"
            class="conv-header-link"
          >
            <UserAvatar
              :url="activeConv.otherUser.avatar_url"
              :name="activeConv.otherUser.display_name || '?'"
              :size="36"
            />
            <div class="conv-header-info">
              <span class="conv-header-name">{{ activeConv.otherUser.display_name }}</span>
              <span class="conv-header-handle">@{{ activeConv.otherUser.username }}</span>
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
              <p v-if="activeConv?.is_group">
                D&eacute;but du groupe <strong>{{ activeConv.group_name }}</strong>
              </p>
              <p v-else>
                D&eacute;but de la conversation avec <strong>{{ activeConv?.otherUser?.display_name }}</strong>
              </p>
              <span>Envoyez votre premier message !</span>
            </div>
            <MessageBubble
              v-for="(msg, i) in messagesStore.currentMessages"
              :key="msg.id"
              :message="msg"
              :isGroup="activeConv?.is_group"
              :firstOfGroup="i === 0 || messagesStore.currentMessages[i - 1].sender_id !== msg.sender_id"
              :showReadStatus="i === lastMineIndex"
              :reactions="reactionsStore.getForMessage(msg.id)"
              @delete="handleDeleteMessage"
              @reply="handleReply"
              @toggle-reaction="handleToggleReaction"
            />
          </template>
        </div>

        <MessageInput
          :replyingTo="replyingTo"
          @send="handleSend"
          @cancel-reply="replyingTo = null"
        />
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

    <GroupMembersModal
      v-if="showGroupModal && activeConv?.is_group"
      :conversation="activeConv"
      @close="showGroupModal = false"
      @updated="onGroupUpdated"
      @deleted="onGroupDeleted"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessagesStore } from '../stores/messages'
import { useReactionsStore } from '../stores/reactions'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/imageCompress'
import { useRealtimeSubscription } from '../composables/useRealtimeSubscription'
import ConversationList from '../components/ConversationList.vue'
import NewConversation from '../components/NewConversation.vue'
import MessageBubble from '../components/MessageBubble.vue'
import MessageInput from '../components/MessageInput.vue'
import UserAvatar from '../components/UserAvatar.vue'
import GroupMembersModal from '../components/GroupMembersModal.vue'

const route = useRoute()
const router = useRouter()
const messagesStore = useMessagesStore()
const reactionsStore = useReactionsStore()
const auth = useAuthStore()

const activeConvId = ref(null)
const activeConv = ref(null)
const messagesContainer = ref(null)
const loadingMessages = ref(false)
const replyingTo = ref(null)
const showGroupModal = ref(false)
const lastMineIndex = computed(() => {
  const myId = auth.activeProfile?.id
  if (!myId) return -1
  const arr = messagesStore.currentMessages
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].sender_id === myId && !arr[i].deleted_for_everyone) return i
  }
  return -1
})

let pollInterval = null
let msgRealtimeSub = null
let reactionsRealtimeSub = null

// Realtime subscription for conversation list updates
const { subscribe: subscribeConvList } = useRealtimeSubscription('conv-list', [
  {
    event: 'INSERT',
    table: 'messages',
    callback: () => messagesStore.fetchConversations(),
  },
])

function setupMessageRealtime(conversationId) {
  if (msgRealtimeSub) { msgRealtimeSub.unsubscribe(); msgRealtimeSub = null }

  const { subscribe, unsubscribe } = useRealtimeSubscription(
    'messages-conv-' + conversationId,
    [{
      event: 'INSERT',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: async (payload) => {
        if (payload.new.sender_id === auth.activeProfile?.id) return
        const wasAtBottom = isNearBottom()
        await messagesStore.fetchMessages(conversationId)
        await messagesStore.markAsRead(conversationId)
        if (wasAtBottom) scrollToBottom()
      },
    },
    {
      event: 'UPDATE',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: async () => {
        // Soft-delete or read updates — don't move scroll
        await messagesStore.fetchMessages(conversationId)
      },
    }]
  )
  msgRealtimeSub = { unsubscribe }
  subscribe()
}

function openConversation(conv) {
  activeConvId.value = conv.id
  activeConv.value = conv
  replyingTo.value = null
  reactionsStore.clearForConversation()
  router.replace(`/messages/${conv.id}`)
  loadMessages()
}

function closeConversation() {
  activeConvId.value = null
  activeConv.value = null
  replyingTo.value = null
  showGroupModal.value = false
  clearInterval(pollInterval)
  pollInterval = null
  if (msgRealtimeSub) { msgRealtimeSub.unsubscribe(); msgRealtimeSub = null }
  if (reactionsRealtimeSub) { reactionsRealtimeSub.unsubscribe(); reactionsRealtimeSub = null }
  reactionsStore.clearForConversation()
  router.replace('/messages')
}

function setupReactionsRealtime(conversationId) {
  if (reactionsRealtimeSub) { reactionsRealtimeSub.unsubscribe(); reactionsRealtimeSub = null }
  const { subscribe, unsubscribe } = useRealtimeSubscription(
    'reactions-conv-' + conversationId,
    [
      {
        event: 'INSERT',
        table: 'message_reactions',
        callback: () => reactionsStore.fetchReactionsForConversation(conversationId),
      },
      {
        event: 'DELETE',
        table: 'message_reactions',
        callback: () => reactionsStore.fetchReactionsForConversation(conversationId),
      },
    ]
  )
  reactionsRealtimeSub = { unsubscribe }
  subscribe()
}

async function handleToggleReaction(messageId, emoji) {
  try {
    await reactionsStore.toggleReaction(messageId, emoji)
  } catch (e) {
    alert('Erreur réaction : ' + (e.message || ''))
  }
}

async function loadMessages() {
  loadingMessages.value = true
  await messagesStore.fetchMessages(activeConvId.value)
  await messagesStore.markAsRead(activeConvId.value)
  await reactionsStore.fetchReactionsForConversation(activeConvId.value)
  loadingMessages.value = false
  scrollToBottom()

  setupMessageRealtime(activeConvId.value)
  setupReactionsRealtime(activeConvId.value)

  clearInterval(pollInterval)
  pollInterval = setInterval(async () => {
    if (!activeConvId.value) return
    const wasAtBottom = isNearBottom()
    await messagesStore.fetchMessages(activeConvId.value)
    await messagesStore.markAsRead(activeConvId.value)
    if (wasAtBottom) scrollToBottom()
  }, 30000)
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

async function handleSend({ content, imageFile }) {
  let imageUrl = null
  if (imageFile) {
    const compressed = await compressImage(imageFile)
    const ext = (compressed.name || imageFile.name).split('.').pop()
    const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('dm-images').upload(fileName, compressed)
    if (uploadError) { alert('Erreur upload'); return }
    const { data: urlData } = supabase.storage.from('dm-images').getPublicUrl(fileName)
    imageUrl = urlData.publicUrl
  }
  const parentId = replyingTo.value?.id || null
  await messagesStore.sendMessage(activeConvId.value, content, imageUrl, parentId)
  replyingTo.value = null
  await messagesStore.fetchMessages(activeConvId.value)
  scrollToBottom()
  messagesStore.fetchConversations()
  window.dispatchEvent(new CustomEvent('dm-message-sent', { detail: { conversationId: activeConvId.value } }))
}

async function handleDeleteMessage(messageId) {
  await messagesStore.deleteMessage(messageId)
}

function handleReply(message) {
  replyingTo.value = message
}

async function onGroupUpdated() {
  // Members were added/removed — refresh active conv data
  await messagesStore.fetchConversations()
  const updated = messagesStore.conversations.find((c) => c.id === activeConvId.value)
  if (updated) activeConv.value = updated
}

function onGroupDeleted() {
  showGroupModal.value = false
  closeConversation()
  messagesStore.fetchConversations()
}

async function handleNewConversation(conversationId) {
  await messagesStore.fetchConversations()
  let conv = messagesStore.conversations.find((c) => c.id === conversationId)
  if (!conv) {
    // Fallback: load directly by id (handles fresh inserts not yet replicated to list)
    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
        user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('id', conversationId)
      .single()
    if (data) {
      const myProfileIds = auth.profiles.map((p) => p.id)
      const otherUser = myProfileIds.includes(data.user1?.id) ? data.user2 : data.user1
      conv = {
        ...data,
        otherUser,
        displayName: otherUser?.display_name || data.group_name || 'Conversation',
      }
    }
  }
  if (conv) openConversation(conv)
}

async function initFromRoute() {
  await messagesStore.fetchConversations()
  if (route.params.id) {
    const conv = messagesStore.conversations.find((c) => c.id === route.params.id)
    if (conv) {
      openConversation(conv)
    }
    // Note: if not in the list, RLS already blocked it (user not a member) — ignore
  }
}

watch(() => route.params.id, (newId) => {
  if (!newId && activeConvId.value) {
    closeConversation()
  }
})

let convPollInterval = null

function onExternalMessageSent(e) {
  const convId = e.detail?.conversationId
  messagesStore.fetchConversations()
  if (activeConvId.value && activeConvId.value === convId) {
    const wasAtBottom = isNearBottom()
    messagesStore.fetchMessages(activeConvId.value).then(() => {
      if (wasAtBottom) scrollToBottom()
    })
  }
}

function onExternalReadUpdate() {
  messagesStore.fetchConversations()
}

onMounted(() => {
  initFromRoute()
  subscribeConvList()
  convPollInterval = setInterval(() => {
    messagesStore.fetchConversations()
  }, 30000)
  window.addEventListener('dm-message-sent', onExternalMessageSent)
  window.addEventListener('dm-read-update', onExternalReadUpdate)
})

onUnmounted(() => {
  clearInterval(pollInterval)
  clearInterval(convPollInterval)
  if (msgRealtimeSub) { msgRealtimeSub.unsubscribe(); msgRealtimeSub = null }
  if (reactionsRealtimeSub) { reactionsRealtimeSub.unsubscribe(); reactionsRealtimeSub = null }
  window.removeEventListener('dm-message-sent', onExternalMessageSent)
  window.removeEventListener('dm-read-update', onExternalReadUpdate)
})
</script>

<style scoped src="./MessagesView.css"></style>
