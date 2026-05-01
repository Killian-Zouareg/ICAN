import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export const useReactionsStore = defineStore('reactions', () => {
  // Map<messageId, Array<{emoji, count, mine, profileIds}>>
  const reactionsByMessage = ref({})

  async function fetchReactionsForConversation(conversationId) {
    const auth = useAuthStore()
    const myProfileIds = new Set(auth.profiles.map((p) => p.id))

    // 1. Fetch message IDs in this conversation (RLS will filter for us if user is participant)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
    if (!msgs || msgs.length === 0) return

    const messageIds = msgs.map((m) => m.id)
    // 2. Fetch reactions for those messages
    const { data: rxs } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, profile_id')
      .in('message_id', messageIds)

    // 3. Aggregate: per message, group by emoji
    const next = {}
    for (const r of rxs || []) {
      if (!next[r.message_id]) next[r.message_id] = {}
      if (!next[r.message_id][r.emoji]) {
        next[r.message_id][r.emoji] = { emoji: r.emoji, count: 0, mine: false, profileIds: [] }
      }
      const entry = next[r.message_id][r.emoji]
      entry.count += 1
      entry.profileIds.push(r.profile_id)
      if (myProfileIds.has(r.profile_id)) entry.mine = true
    }

    // Convert per-message map to sorted array
    const finalMap = {}
    for (const [msgId, byEmoji] of Object.entries(next)) {
      finalMap[msgId] = REACTION_EMOJIS
        .filter((e) => byEmoji[e])
        .map((e) => byEmoji[e])
    }
    reactionsByMessage.value = finalMap
  }

  async function toggleReaction(messageId, emoji) {
    const auth = useAuthStore()
    const myProfileId = auth.activeProfile.id

    // Check if I already reacted with this emoji
    const list = reactionsByMessage.value[messageId] || []
    const entry = list.find((r) => r.emoji === emoji)
    const alreadyMine = entry?.profileIds?.includes(myProfileId)

    if (alreadyMine) {
      // Remove
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('profile_id', myProfileId)
        .eq('emoji', emoji)
      if (error) throw error
      // Optimistic local update
      entry.count -= 1
      entry.profileIds = entry.profileIds.filter((id) => id !== myProfileId)
      if (entry.count <= 0) {
        reactionsByMessage.value[messageId] = list.filter((r) => r.emoji !== emoji)
      } else {
        // Recompute mine
        const myIds = new Set(auth.profiles.map((p) => p.id))
        entry.mine = entry.profileIds.some((id) => myIds.has(id))
      }
    } else {
      // Add
      const { error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, profile_id: myProfileId, emoji })
      if (error) throw error
      if (!reactionsByMessage.value[messageId]) reactionsByMessage.value[messageId] = []
      const existing = reactionsByMessage.value[messageId].find((r) => r.emoji === emoji)
      if (existing) {
        existing.count += 1
        existing.profileIds.push(myProfileId)
        existing.mine = true
      } else {
        reactionsByMessage.value[messageId].push({
          emoji,
          count: 1,
          mine: true,
          profileIds: [myProfileId],
        })
        // Sort by canonical emoji order
        reactionsByMessage.value[messageId].sort(
          (a, b) => REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji)
        )
      }
    }
  }

  function clearForConversation() {
    reactionsByMessage.value = {}
  }

  function getForMessage(messageId) {
    return reactionsByMessage.value[messageId] || []
  }

  return {
    reactionsByMessage,
    fetchReactionsForConversation,
    toggleReaction,
    clearForConversation,
    getForMessage,
  }
})
