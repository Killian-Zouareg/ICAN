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
    if (!auth.activeProfile) return
    const profileId = auth.activeProfile.id
    loading.value = true

    const { data } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
        user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
      .order('updated_at', { ascending: false })

    conversations.value = (data || []).map((conv) => {
      const otherUser = conv.user1.id === profileId ? conv.user2 : conv.user1
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
    await auth.checkBan()
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: auth.activeProfile.id,
      content,
    })
    if (error) throw error

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  async function getOrCreateConversation(otherProfileId) {
    const auth = useAuthStore()
    const myId = auth.activeProfile.id
    const [user1, user2] = myId < otherProfileId
      ? [myId, otherProfileId]
      : [otherProfileId, myId]

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
      .neq('sender_id', auth.activeProfile.id)
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
