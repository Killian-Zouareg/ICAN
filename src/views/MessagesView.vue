<template>
  <div class="messages-page">
    <div class="page-header">
      <h2>Messages</h2>
    </div>

    <div v-if="messagesStore.loading" class="loading">Chargement...</div>
    <ConversationList v-else :conversations="messagesStore.conversations" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useMessagesStore } from '../stores/messages'
import ConversationList from '../components/ConversationList.vue'

const messagesStore = useMessagesStore()

onMounted(() => {
  messagesStore.fetchConversations()
})
</script>

<style scoped>
.messages-page {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: calc(100vh - 52px);
}

.page-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.page-header h2 {
  font-size: 1.2rem;
  margin: 0;
}
</style>
