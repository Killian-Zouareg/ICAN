<template>
  <div class="game3d-page">
    <canvas ref="canvasRef" class="game3d-canvas"></canvas>

    <div class="game3d-hud">
      <div class="hud-top">
        <button class="hud-back" @click="handleBack">&larr; Quitter</button>
        <div class="hud-stats">
          <span class="hud-dot" :class="{ online: store.connected }"></span>
          <span>{{ store.playerCount }} joueur{{ store.playerCount > 1 ? 's' : '' }}</span>
        </div>
        <button
          class="hud-mic"
          :class="{ on: voiceOn && !voiceMuted, muted: voiceOn && voiceMuted, error: voiceError }"
          :title="voiceTitle"
          @click="toggleVoice"
        >
          <span v-if="!voiceOn">&#x1F399;</span>
          <span v-else-if="voiceMuted">&#x1F507;</span>
          <span v-else>&#x1F3A4;</span>
          <span class="hud-mic-label">{{ voiceLabel }}</span>
          <span class="hud-mic-hint">V</span>
        </button>
      </div>

      <div v-if="!locked" class="hud-overlay" @click="requestLock">
        <div class="hud-overlay-card">
          <h1>Hub Social 3D</h1>
          <p class="hud-subtitle">Clique pour entrer dans le monde iCAN</p>
          <div class="hud-controls">
            <div><kbd>Z</kbd> <kbd>Q</kbd> <kbd>S</kbd> <kbd>D</kbd> &mdash; Se d&eacute;placer</div>
            <div><kbd>Souris</kbd> &mdash; Regarder</div>
            <div><kbd>Entr&eacute;e</kbd> &mdash; Chat &nbsp;|&nbsp; <kbd>&Eacute;chap</kbd> &mdash; Lib&eacute;rer</div>
            <div><kbd>V</kbd> &mdash; Micro (proximit&eacute;)</div>
          </div>
          <button class="hud-play-btn" @click.stop="requestLock">Jouer</button>
        </div>
      </div>

      <div v-if="locked" class="hud-crosshair"></div>

      <div class="hud-chat" :class="{ focused: chatFocused }">
        <div class="hud-chat-log">
          <div v-for="(m, i) in store.chatLog" :key="i" class="hud-chat-msg">
            <span class="hud-chat-name">@{{ m.username }}</span>
            <span>{{ m.text }}</span>
          </div>
        </div>
        <input
          ref="chatRef"
          v-model="chatText"
          class="hud-chat-input"
          type="text"
          maxlength="200"
          placeholder="Entr&eacute;e pour &eacute;crire..."
          @focus="chatFocused = true"
          @blur="chatFocused = false"
          @keydown.enter.prevent="submitChat"
          @keydown.esc.prevent="blurChat"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGame3dStore } from '../stores/game3d'
import { GameEngine } from '../lib/game3d/engine'
import { VoiceManager } from '../lib/game3d/voice'

const auth = useAuthStore()
const store = useGame3dStore()
const router = useRouter()

const canvasRef = ref(null)
const chatRef = ref(null)
const locked = ref(false)
const chatFocused = ref(false)
const chatText = ref('')
const voiceOn = ref(false)
const voiceMuted = ref(false)
const voiceError = ref(null)

let engine = null
let voice = null

const voiceLabel = computed(() => {
  if (voiceError.value) return 'Erreur'
  if (!voiceOn.value) return 'Activer micro'
  return voiceMuted.value ? 'Muet' : 'En ligne'
})
const voiceTitle = computed(() => {
  if (voiceError.value) return voiceError.value
  if (!voiceOn.value) return 'Activer le chat vocal de proximité'
  return voiceMuted.value ? 'Cliquer pour réactiver le micro' : 'Cliquer pour couper le micro'
})

function requestLock() {
  if (!engine) return
  engine.lock()
}

function handleBack() {
  router.push('/')
}

function submitChat() {
  const text = chatText.value
  chatText.value = ''
  if (text.trim()) store.sendChat(text)
  blurChat()
}

function blurChat() {
  chatRef.value?.blur()
  chatFocused.value = false
  if (engine && !engine.isLocked) engine.lock()
}

function onGlobalKey(e) {
  if (chatFocused.value) return
  if (e.key === 'Enter' && engine?.isLocked) {
    e.preventDefault()
    engine.unlock()
    nextTick(() => chatRef.value?.focus())
    return
  }
  if (e.code === 'KeyV' && !e.repeat) {
    e.preventDefault()
    toggleVoice()
  }
}

function maybeCall(peerId, peerMeta) {
  if (!voiceOn.value || !voice) return
  if (!peerMeta?.voiceActive) return
  if (auth.activeProfile.id >= peerId) return
  voice.callPeer(peerId)
}

async function toggleVoice() {
  voiceError.value = null
  if (!voice) return

  if (!voiceOn.value) {
    try {
      await voice.start()
      engine?.resumeAudioContext()
      voiceOn.value = true
      voiceMuted.value = false
      await store.setVoiceActive(true)
      for (const [peerId, meta] of store.peers) {
        maybeCall(peerId, meta)
      }
    } catch (err) {
      voiceError.value = err?.message || 'Micro indisponible'
      voiceOn.value = false
    }
    return
  }

  if (voiceMuted.value) {
    voice.setMuted(false)
    voiceMuted.value = false
  } else {
    voice.setMuted(true)
    voiceMuted.value = true
  }
}

onMounted(async () => {
  if (!auth.activeProfile) {
    router.replace('/login')
    return
  }

  engine = new GameEngine(canvasRef.value, {
    localProfile: auth.activeProfile,
    onMove: (pos) => store.sendMove(pos),
  })
  engine.onLockChange((isLocked) => { locked.value = isLocked })

  voice = new VoiceManager({
    myId: auth.activeProfile.id,
    onSignal: (toId, kind, data) => store.sendVoiceSignal(toId, kind, data),
    onRemoteStream: (peerId, stream) => engine?.attachRemoteAudio(peerId, stream),
    onRemoteEnd: (peerId) => engine?.detachRemoteAudio(peerId),
  })

  document.addEventListener('keydown', onGlobalKey)

  await store.joinRoom(auth.activeProfile, {
    onJoin: (meta) => {
      engine.upsertRemote({
        profileId: meta.profileId,
        username: meta.username,
        avatarUrl: meta.avatarUrl,
        x: 0, y: 0, z: 0, rot: 0,
      })
      maybeCall(meta.profileId, meta)
    },
    onLeave: (profileId) => {
      voice?.removePeer(profileId)
      engine.removeRemote(profileId)
    },
    onMove: (payload) => {
      engine.upsertRemote({
        profileId: payload.profileId,
        x: payload.x, y: payload.y, z: payload.z, rot: payload.rot,
      })
    },
    onPeerVoice: (meta) => {
      maybeCall(meta.profileId, meta)
    },
    onVoiceSignal: (from, kind, data) => {
      voice?.handleSignal(from, kind, data)
    },
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKey)
  voice?.stop()
  voice = null
  store.leaveRoom()
  if (engine) {
    engine.dispose()
    engine = null
  }
})
</script>

<style scoped src="./GameView.css"></style>
