<template>
  <div class="conversation-page">
    <div class="conv-header">
      <button @click="$router.push('/messages')" class="back-btn">&larr;</button>
      <span v-if="otherUser" class="conv-title">{{ otherUser.display_name }}</span>
    </div>

    <div class="messages-list" ref="messagesContainer">
      <div v-if="messagesStore.loading" class="loading">Chargement...</div>
      <template v-else>
        <div v-if="messagesStore.currentMessages.length === 0" class="empty">
          Début de la conversation
        </div>
        <MessageBubble
          v-for="msg in messagesStore.currentMessages"
          :key="msg.id"
          :message="msg"
        />
      </template>
    </div>

    <MessageInput @send="handleSend" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMessagesStore } from '../stores/messages'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import MessageBubble from '../components/MessageBubble.vue'
import MessageInput from '../components/MessageInput.vue'

const route = useRoute()
const messagesStore = useMessagesStore()
const auth = useAuthStore()
const messagesContainer = ref(null)
const otherUser = ref(null)
let pollInterval = null

const conversationId = route.params.id

async function loadConversation() {
  const { data } = await supabase
    .from('conversations')
    .select(`
      *,
      user1:profiles!conversations_user1_id_fkey(id, username, display_name),
      user2:profiles!conversations_user2_id_fkey(id, username, display_name)
    `)
    .eq('id', conversationId)
    .single()

  if (data) {
    const myProfileIds = auth.profiles.map((p) => p.id)
    otherUser.value = myProfileIds.includes(data.user1.id) ? data.user2 : data.user1
  }
}

async function loadMessages() {
  await messagesStore.fetchMessages(conversationId)
  await messagesStore.markAsRead(conversationId)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSend(content) {
  await messagesStore.sendMessage(conversationId, content)
  await loadMessages()
}

onMounted(async () => {
  await Promise.all([loadConversation(), loadMessages()])
  pollInterval = setInterval(loadMessages, 10000)
})

onUnmounted(() => {
  clearInterval(pollInterval)
})
</script>

<style scoped>
.conversation-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 52px);
}

.conv-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1.2rem;
}

.conv-title {
  font-weight: 600;
  font-size: 1.05rem;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty {
  text-align: center;
  color: var(--text-secondary);
  margin-top: 2rem;
}
</style>
