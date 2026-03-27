import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useMessagesStore = defineStore('messages', () => {
  const conversations = ref([])
  const currentMessages = ref([])
  const loading = ref(false)

  async function fetchConversations() {
    const auth = useAuthStore()
    if (!auth.user) return
    loading.value = true

    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
        user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`user1_id.eq.${auth.user.id},user2_id.eq.${auth.user.id}`)
      .order('updated_at', { ascending: false })

    conversations.value = (data || []).map((conv) => {
      const otherUser = conv.user1.id === auth.user.id ? conv.user2 : conv.user1
      return { ...conv, otherUser }
    })

    loading.value = false
  }

  async function fetchMessages(conversationId) {
    loading.value = true
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    currentMessages.value = data || []
    loading.value = false
  }

  async function sendMessage(conversationId, content) {
    const auth = useAuthStore()
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      content,
    })
    if (error) throw error

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  async function getOrCreateConversation(otherUserId) {
    const auth = useAuthStore()
    const [user1, user2] = auth.user.id < otherUserId
      ? [auth.user.id, otherUserId]
      : [otherUserId, auth.user.id]

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .maybeSingle()

    if (existing) return existing.id

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ user1_id: user1, user2_id: user2 })
      .select('id')
      .single()

    if (error) throw error
    return created.id
  }

  async function markAsRead(conversationId) {
    const auth = useAuthStore()
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', auth.user.id)
      .eq('read', false)
  }

  return {
    conversations,
    currentMessages,
    loading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    getOrCreateConversation,
    markAsRead,
  }
})
