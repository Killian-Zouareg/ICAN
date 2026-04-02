import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUUID(value, label) {
  if (!value || !UUID_RE.test(value)) {
    throw new Error(`Invalid UUID for ${label}`)
  }
}

export const useMessagesStore = defineStore('messages', () => {
  const conversations = ref([])
  const currentMessages = ref([])
  const loading = ref(false)
  const hiddenConvIds = ref(new Set())

  async function fetchConversations() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const profileId = auth.activeProfile.id
    assertUUID(profileId, 'profileId')
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

    conversations.value = (data || [])
      .filter((conv) => !hiddenConvIds.value.has(conv.id))
      .map((conv) => {
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
    if (!content?.trim()) throw new Error('Le message ne peut pas être vide')
    if (content.length > 2000) throw new Error('Le message ne doit pas dépasser 2000 caractères')
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

  async function deleteMessage(messageId) {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) throw error
    currentMessages.value = currentMessages.value.filter((m) => m.id !== messageId)
  }

  function hideConversation(conversationId) {
    hiddenConvIds.value.add(conversationId)
    conversations.value = conversations.value.filter((c) => c.id !== conversationId)
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
    deleteMessage,
    hideConversation,
    hiddenConvIds,
  }
})
