import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { supabase } from '../lib/supabase'

const ROOM = 'game3d-lobby'

export const useGame3dStore = defineStore('game3d', () => {
  const connected = ref(false)
  const playerCount = ref(0)
  const chatLog = ref([])
  const peers = shallowRef(new Map())

  let channel = null
  let myProfile = null
  let handlers = {}

  function _emitPeers() {
    peers.value = new Map(peers.value)
  }

  async function joinRoom(profile, { onMove, onJoin, onLeave, onChat, onVoiceSignal } = {}) {
    if (channel) await leaveRoom()
    myProfile = profile
    handlers = { onMove, onJoin, onLeave, onChat, onVoiceSignal }
    connected.value = false
    chatLog.value = []

    channel = supabase.channel(ROOM, {
      config: {
        broadcast: { self: false },
        presence: { key: profile.id },
      },
    })

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!payload || payload.profileId === myProfile?.id) return
      onMove?.(payload)
    })

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (!payload) return
      chatLog.value = [...chatLog.value.slice(-30), payload]
      onChat?.(payload)
    })

    channel.on('broadcast', { event: 'voice' }, ({ payload }) => {
      if (!payload || payload.to !== myProfile?.id) return
      onVoiceSignal?.(payload.from, payload.kind, payload.data)
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const next = new Map()
      for (const key of Object.keys(state)) {
        const metas = state[key]
        if (!metas?.length) continue
        const meta = metas[0]
        if (meta.profileId === myProfile?.id) continue
        next.set(meta.profileId, meta)
      }
      const prev = peers.value
      for (const [id, meta] of next) {
        if (!prev.has(id)) onJoin?.(meta)
      }
      for (const id of prev.keys()) {
        if (!next.has(id)) onLeave?.(id)
      }
      peers.value = next
      playerCount.value = next.size + 1
    })

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          profileId: profile.id,
          username: profile.username,
          avatarUrl: profile.avatar_url,
        })
        connected.value = true
      }
    })
  }

  function sendMove(pos) {
    if (!channel || !connected.value) return
    channel.send({
      type: 'broadcast',
      event: 'move',
      payload: { profileId: myProfile.id, ...pos },
    })
  }

  function sendVoiceSignal(toId, kind, data) {
    if (!channel || !connected.value) return
    channel.send({
      type: 'broadcast',
      event: 'voice',
      payload: { from: myProfile.id, to: toId, kind, data },
    })
  }

  function sendChat(text) {
    if (!channel || !connected.value || !text.trim()) return
    const payload = {
      profileId: myProfile.id,
      username: myProfile.username,
      text: text.trim().slice(0, 200),
      ts: Date.now(),
    }
    channel.send({ type: 'broadcast', event: 'chat', payload })
    chatLog.value = [...chatLog.value.slice(-30), payload]
  }

  async function leaveRoom() {
    if (!channel) return
    const c = channel
    channel = null
    connected.value = false
    playerCount.value = 0
    peers.value = new Map()
    handlers = {}
    try { await supabase.removeChannel(c) } catch { /* ignore */ }
  }

  return { connected, playerCount, chatLog, peers, joinRoom, sendMove, sendChat, sendVoiceSignal, leaveRoom }
})
