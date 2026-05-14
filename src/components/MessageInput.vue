<template>
  <div class="msg-input-area">
    <!-- Reply banner -->
    <div v-if="replyingTo" class="reply-banner">
      <div class="reply-info">
        <span class="reply-label">Réponse à <strong>{{ replyingTo.sender?.display_name || '?' }}</strong></span>
        <span class="reply-preview">{{ replyPreview }}</span>
      </div>
      <button class="reply-cancel" @click="$emit('cancel-reply')" title="Annuler la réponse">&times;</button>
    </div>

    <div v-if="imagePreview" class="image-preview">
      <div class="image-preview-wrap">
        <img :src="imagePreview" alt="Preview" />
        <button class="remove-image" @click="removeImage">&times;</button>
      </div>
    </div>
    <!-- Pending live location chip -->
    <div v-if="pendingShare" class="msg-live-loc-pending">
      <span>&#x1F4CD;</span>
      <span class="msg-live-loc-text">Position en direct · <strong>{{ pendingShareLabel }}</strong></span>
      <button type="button" class="msg-live-loc-remove" @click="pendingShare = null">&times;</button>
    </div>

    <form class="message-input" @submit.prevent="submit">
      <button type="button" class="action-btn" @click="$refs.fileInput.click()" title="Envoyer une image">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ 'live-loc-on': !!pendingShare }"
        @click="openShareModal"
        :title="pendingShare ? 'Partage en attente' : 'Partager ma position en direct'"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </button>
      <MentionInput
        v-model="content"
        tag="input"
        dropdown-position="top"
        type="text"
        :placeholder="replyingTo ? 'Répondre...' : 'Écrire un message...'"
        maxlength="1000"
        @keydown.enter.exact="onEnter"
      />
      <button type="submit" class="send-btn" :disabled="!content.trim() && !imageFile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      style="display: none"
      @change="handleFileChange"
    />

    <!-- Live location share modal -->
    <div v-if="showShareModal" class="msg-live-loc-overlay" @click.self="showShareModal = false">
      <div class="msg-live-loc-modal">
        <div class="msg-live-loc-header">
          <h3>Partager ma position en direct</h3>
          <button class="msg-live-loc-close" @click="showShareModal = false">&times;</button>
        </div>
        <div v-if="!tokenStore.myToken" class="msg-live-loc-empty">
          <p>Tu n'as pas encore placé ton token sur la carte.</p>
          <router-link to="/map" class="msg-live-loc-go-map">Placer mon token &rarr;</router-link>
        </div>
        <template v-else>
          <p class="msg-live-loc-coords">
            Token actuel : <strong>{{ tokenStore.myToken.lat.toFixed(4) }}, {{ tokenStore.myToken.lng.toFixed(4) }}</strong>
          </p>
          <p class="msg-live-loc-help">
            La position sera visible uniquement par les membres de cette conversation.
          </p>
          <div class="msg-live-loc-grid">
            <button
              v-for="d in SHARE_DURATIONS"
              :key="d.minutes"
              class="msg-live-loc-dur"
              :class="{ active: selectedDuration === d.minutes }"
              @click="selectedDuration = d.minutes"
            >
              {{ d.label }}
            </button>
          </div>
          <div class="msg-live-loc-actions">
            <button class="msg-live-loc-cancel" @click="showShareModal = false">Annuler</button>
            <button class="msg-live-loc-save" @click="confirmShare">Activer le partage</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MentionInput from './MentionInput.vue'
import { useUserTokenStore, SHARE_DURATIONS } from '../stores/userToken'

const props = defineProps({
  replyingTo: { type: Object, default: null },
})

const emit = defineEmits(['send', 'cancel-reply'])
const content = ref('')
const imageFile = ref(null)
const imagePreview = ref(null)

const tokenStore = useUserTokenStore()
const showShareModal = ref(false)
const selectedDuration = ref(SHARE_DURATIONS[0].minutes)
const pendingShare = ref(null) // { durationMinutes }

const pendingShareLabel = computed(() => {
  if (!pendingShare.value) return ''
  const m = SHARE_DURATIONS.find((x) => x.minutes === pendingShare.value.durationMinutes)
  return m ? m.label : ''
})

function openShareModal() {
  if (pendingShare.value) {
    if (confirm('Retirer le partage de position ?')) pendingShare.value = null
    return
  }
  tokenStore.fetchMyToken()
  selectedDuration.value = SHARE_DURATIONS[0].minutes
  showShareModal.value = true
}

function confirmShare() {
  if (!tokenStore.myToken) return
  pendingShare.value = { durationMinutes: selectedDuration.value }
  showShareModal.value = false
}

const replyPreview = computed(() => {
  if (!props.replyingTo) return ''
  const c = props.replyingTo.content || ''
  if (!c) return props.replyingTo.image_url ? '🖼️ Image' : ''
  return c.length > 60 ? c.slice(0, 60) + '...' : c
})

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('Image trop lourde (max 5 Mo)')
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = null
}

function onEnter(e) {
  // If MentionInput's dropdown handled Enter (to pick a suggestion), skip submit
  if (e.defaultPrevented) return
  e.preventDefault()
  submit()
}

function submit() {
  if (!content.value.trim() && !imageFile.value && !pendingShare.value) return
  emit('send', {
    content: content.value.trim(),
    imageFile: imageFile.value,
    pendingShare: pendingShare.value,
  })
  content.value = ''
  removeImage()
  pendingShare.value = null
}
</script>

<style scoped src="./MessageInput.css"></style>
