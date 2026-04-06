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

  async function fetchConversations() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const profileId = auth.activeProfile.id
    const allProfileIds = auth.profiles.map((p) => p.id)
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

    // Fetch hidden conversation IDs from DB
    const { data: hiddenData } = await supabase
      .from('conversation_hidden')
      .select('conversation_id')
      .eq('profile_id', profileId)
    const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id))

    const allConvs = (data || [])
      .filter((conv) => !hiddenIds.has(conv.id))
      .map((conv) => {
        const otherUser = conv.user1.id === profileId ? conv.user2 : conv.user1
        return { ...conv, otherUser }
      })

    // Fetch last messages + unread status
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
            ? (last.content.length > 50 ? last.content.slice(0, 50) + '...' : last.content)
            : (last.image_url ? '\ud83d\uddbc\ufe0f Image' : null))
          : null,
        lastMessageTime: last?.created_at || conv.updated_at,
        hasUnread: unreadSet.has(conv.id),
      }
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

  async function sendMessage(conversationId, content, imageUrl = null) {
    const auth = useAuthStore()
    await auth.checkBan()
    if (!content?.trim() && !imageUrl) throw new Error('Le message ne peut pas être vide')
    if (content && content.length > 2000) throw new Error('Le message ne doit pas dépasser 2000 caractères')
    const insertData = {
      conversation_id: conversationId,
      sender_id: auth.activeProfile.id,
      content: content || '',
    }
    if (imageUrl) insertData.image_url = imageUrl
    const { error } = await supabase.from('messages').insert(insertData)
    if (error) throw error

    // Unhide conversation if it was hidden (new message = reappear)
    await unhideConversation(conversationId)

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

    // Optimistic: update local state immediately
    for (const m of currentMessages.value) {
      if (m.sender_id !== auth.activeProfile.id) m.read = true
    }
    // Update conversation hasUnread
    const conv = conversations.value.find((c) => c.id === conversationId)
    if (conv) conv.hasUnread = false

    // Notify other components
    window.dispatchEvent(new Event('dm-read-update'))

    // Persist to server
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

  async function hideConversation(conversationId) {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    await supabase.from('conversation_hidden').upsert({
      profile_id: auth.activeProfile.id,
      conversation_id: conversationId,
    })
    conversations.value = conversations.value.filter((c) => c.id !== conversationId)
  }

  async function unhideConversation(conversationId) {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    await supabase
      .from('conversation_hidden')
      .delete()
      .eq('profile_id', auth.activeProfile.id)
      .eq('conversation_id', conversationId)
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
    unhideConversation,
  }
})
