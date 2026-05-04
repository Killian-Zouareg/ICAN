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
  // Per-member last_read_at for the currently open conversation (groups only).
  // Map<profile_id, { profile, last_read_at }>
  const currentGroupReads = ref(new Map())

  async function fetchConversations() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const profileId = auth.activeProfile.id
    assertUUID(profileId, 'profileId')
    loading.value = true
    // 1-on-1: STRICT per-profile isolation — each profile has its own DM list.
    // Groups (user1/user2 NULL) are excluded naturally by these filters.
    const { data: dmData, error: dmErr } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:profiles!conversations_user1_id_fkey(id, username, display_name, avatar_url),
        user2:profiles!conversations_user2_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`)
      .order('updated_at', { ascending: false })
    if (dmErr) {
      console.error('[messages] fetchConversations dmData error:', dmErr)
      loading.value = false
      return
    }

    // Groups via membership — STRICT per-profile isolation.
    let groupConvs = []
    try {
      const { data: myMemberships, error: memErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', profileId)
      if (memErr) {
        console.warn('[messages] conversation_members fetch error:', memErr)
      } else if (myMemberships && myMemberships.length > 0) {
        const groupIds = [...new Set(myMemberships.map((m) => m.conversation_id))]
        const { data: groups, error: grpErr } = await supabase
          .from('conversations')
          .select('*')
          .eq('is_group', true)
          .in('id', groupIds)
          .order('updated_at', { ascending: false })
        if (grpErr) {
          console.warn('[messages] groups fetch error:', grpErr)
        } else if (groups && groups.length > 0) {
          const { data: allMembers } = await supabase
            .from('conversation_members')
            .select('conversation_id, profile_id, profiles(id, username, display_name, avatar_url)')
            .in('conversation_id', groups.map((g) => g.id))

          const membersByConv = {}
          ;(allMembers || []).forEach((m) => {
            if (!membersByConv[m.conversation_id]) membersByConv[m.conversation_id] = []
            membersByConv[m.conversation_id].push(m.profiles)
          })
          groupConvs = groups.map((g) => ({
            ...g,
            members: membersByConv[g.id] || [],
          }))
        }
      }
    } catch (e) {
      console.warn('[messages] groups path threw:', e)
    }

    // Hidden conversations
    const { data: hiddenData } = await supabase
      .from('conversation_hidden')
      .select('conversation_id')
      .eq('profile_id', profileId)
    const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id))

    const allConvs = [
      ...(dmData || []).map((conv) => {
        const otherUser = conv.user1?.id === profileId ? conv.user2 : conv.user1
        return {
          ...conv,
          otherUser,
          displayName: otherUser?.display_name || '?',
        }
      }),
      ...groupConvs.map((conv) => ({
        ...conv,
        otherUser: null,
        displayName: conv.group_name || 'Groupe',
      })),
    ]
      .filter((conv) => !hiddenIds.has(conv.id))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

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
        .neq('sender_id', profileId)
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

  async function fetchGroupReads(conversationId) {
    const { data, error } = await supabase
      .from('conversation_members')
      .select('profile_id, last_read_at, profiles(id, username, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
    if (error) {
      console.warn('[messages] fetchGroupReads error:', error)
      currentGroupReads.value = new Map()
      return
    }
    const map = new Map()
    ;(data || []).forEach((row) => {
      if (!row.profiles) return
      map.set(row.profile_id, { profile: row.profiles, last_read_at: row.last_read_at })
    })
    currentGroupReads.value = map
  }

  function patchGroupRead(profileId, lastReadAt) {
    const existing = currentGroupReads.value.get(profileId)
    if (!existing) return
    const next = new Map(currentGroupReads.value)
    next.set(profileId, { ...existing, last_read_at: lastReadAt })
    currentGroupReads.value = next
  }

  async function fetchMessages(conversationId) {
    loading.value = true
    // Determine if it's a group to decide whether to load per-member reads.
    const conv = conversations.value.find((c) => c.id === conversationId)
    const isGroup = conv?.is_group === true
    if (isGroup) {
      fetchGroupReads(conversationId).catch((e) => console.warn('[messages] groupReads:', e))
    } else {
      currentGroupReads.value = new Map()
    }
    // On charge les 100 derniers messages (DESC + limit), puis on inverse côté JS
    // pour garder l'ordre chronologique attendu par l'UI.
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('fetchMessages error:', error)
      loading.value = false
      return
    }

    const newData = (data || []).reverse()

    // Hydrate parent message previews (for replies) in a second batch query.
    // We do this separately so a failure here never wipes the message list.
    const parentIds = [...new Set(newData.filter((m) => m.parent_message_id).map((m) => m.parent_message_id))]
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('messages')
        .select('id, content, sender_id, deleted_for_everyone, image_url, sender:profiles!messages_sender_id_fkey(id, username, display_name)')
        .in('id', parentIds)
      const parentMap = {}
      ;(parents || []).forEach((p) => { parentMap[p.id] = p })
      for (const m of newData) {
        if (m.parent_message_id && parentMap[m.parent_message_id]) {
          m.parent = parentMap[m.parent_message_id]
        }
      }
    }

    const local = currentMessages.value

    // Smart merge: if same set of IDs, patch fields in place to preserve DOM/scroll.
    // Otherwise replace (Vue's keyed reconciliation will reuse common bubbles).
    let sameSet = local.length === newData.length
    if (sameSet) {
      for (let i = 0; i < newData.length; i++) {
        if (local[i].id !== newData[i].id) { sameSet = false; break }
      }
    }

    if (sameSet && newData.length > 0) {
      for (let i = 0; i < newData.length; i++) {
        Object.assign(local[i], newData[i])
      }
    } else {
      currentMessages.value = newData
    }
    loading.value = false
  }

  async function sendMessage(conversationId, content, imageUrl = null, parentMessageId = null) {
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
    if (parentMessageId) insertData.parent_message_id = parentMessageId
    const { error } = await supabase.from('messages').insert(insertData)
    if (error) throw error

    // Unhide conversation if it was hidden (new message = reappear)
    await unhideConversation(conversationId)

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Mention notifications (group conversations only)
    if (content) {
      try {
        await notifyMentions(conversationId, content, auth.activeProfile.id)
      } catch (e) {
        console.warn('[messages] notifyMentions failed:', e)
      }
    }
  }

  async function notifyMentions(conversationId, content, senderId) {
    const usernames = [...new Set(
      [...content.matchAll(/(?:^|\s)@([a-zA-Z0-9_]+)/g)].map((m) => m[1].toLowerCase())
    )]
    if (usernames.length === 0) return

    const { data: conv } = await supabase
      .from('conversations')
      .select('id, is_group')
      .eq('id', conversationId)
      .single()
    if (!conv?.is_group) return

    const { data: members } = await supabase
      .from('conversation_members')
      .select('profile_id, profiles(id, username)')
      .eq('conversation_id', conversationId)
    if (!members) return

    const recipients = members
      .map((m) => m.profiles)
      .filter((p) => p && p.id !== senderId && usernames.includes((p.username || '').toLowerCase()))
      .map((p) => p.id)

    if (recipients.length === 0) return

    const rows = recipients.map((rid) => ({
      type: 'mention',
      actor_id: senderId,
      recipient_id: rid,
      read: false,
    }))
    await supabase.from('notifications').insert(rows)
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

    // Per-member read tracking (utile en groupe pour le "vu par")
    const now = new Date().toISOString()
    await supabase
      .from('conversation_members')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('profile_id', auth.activeProfile.id)

    // Optimistic local patch for the open conversation
    patchGroupRead(auth.activeProfile.id, now)
  }

  async function deleteMessage(messageId) {
    const auth = useAuthStore()
    // Soft-delete: keep the row, mark as deleted, clear content/image
    const { error } = await supabase
      .from('messages')
      .update({
        deleted_for_everyone: true,
        content: '',
        image_url: null,
      })
      .eq('id', messageId)
      .eq('sender_id', auth.activeProfile.id)
    if (error) throw error
    // Mirror the change locally to update bubble state instantly
    const local = currentMessages.value.find((m) => m.id === messageId)
    if (local) {
      local.deleted_for_everyone = true
      local.content = ''
      local.image_url = null
    }
  }

  // -------- Group conversations --------

  async function createGroupConversation(groupName, memberIds) {
    if (!groupName?.trim()) throw new Error('Nom de groupe requis')
    if (!memberIds || memberIds.length < 2) throw new Error('Au moins 2 membres requis')
    const { data, error } = await supabase.rpc('create_group_conversation', {
      p_group_name: groupName.trim(),
      p_member_ids: memberIds,
    })
    if (error) throw error
    return data // conversation_id (UUID)
  }

  async function addGroupMembers(conversationId, memberIds) {
    if (!memberIds || memberIds.length === 0) return
    const { error } = await supabase.rpc('add_members_to_group', {
      p_conversation_id: conversationId,
      p_member_ids: memberIds,
    })
    if (error) throw error
  }

  async function deleteGroupConversation(conversationId) {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
    if (error) throw error
    conversations.value = conversations.value.filter((c) => c.id !== conversationId)
  }

  async function fetchGroupMembers(conversationId) {
    const { data, error } = await supabase
      .from('conversation_members')
      .select('profile_id, joined_at, profiles(id, username, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true })
    if (error) throw error
    return (data || []).map((m) => ({
      ...m.profiles,
      joined_at: m.joined_at,
    }))
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
    currentGroupReads,
    loading,
    fetchConversations,
    fetchMessages,
    fetchGroupReads,
    patchGroupRead,
    sendMessage,
    getOrCreateConversation,
    markAsRead,
    deleteMessage,
    hideConversation,
    unhideConversation,
    createGroupConversation,
    addGroupMembers,
    deleteGroupConversation,
    fetchGroupMembers,
  }
})
