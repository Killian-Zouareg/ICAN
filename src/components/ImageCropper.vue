<template>
  <div class="cropper-overlay" @click.self="$emit('cancel')">
    <div class="cropper-modal">
      <h3 class="cropper-title">Recadrer la photo de profil</h3>
      <div class="cropper-area" ref="cropArea"
        @mousedown="startDrag" @touchstart.prevent="startDrag"
        @wheel.prevent="onWheel"
      >
        <img ref="imgEl" :src="src" class="cropper-img"
          :style="imgStyle" draggable="false" @load="onImgLoad" />
        <div class="cropper-circle"></div>
      </div>
      <div class="cropper-controls">
        <span class="zoom-label">Zoom</span>
        <input type="range" class="zoom-slider" min="1" max="3" step="0.01" v-model.number="scale" />
      </div>
      <div class="cropper-actions">
        <button class="cropper-btn cancel" @click="$emit('cancel')">Annuler</button>
        <button class="cropper-btn confirm" @click="crop">Appliquer</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
})

const emit = defineEmits(['cancel', 'crop'])

const cropArea = ref(null)
const imgEl = ref(null)
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const imgNatW = ref(0)
const imgNatH = ref(0)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, ox: 0, oy: 0 })

const AREA_SIZE = 280
const CIRCLE_SIZE = 240

const imgStyle = computed(() => {
  // Fit image so its smallest side fills the circle, then apply scale
  let w, h
  if (imgNatW.value >= imgNatH.value) {
    h = CIRCLE_SIZE * scale.value
    w = (imgNatW.value / imgNatH.value) * h
  } else {
    w = CIRCLE_SIZE * scale.value
    h = (imgNatH.value / imgNatW.value) * w
  }
  return {
    width: w + 'px',
    height: h + 'px',
    transform: `translate(${offsetX.value}px, ${offsetY.value}px)`,
  }
})

function onImgLoad() {
  imgNatW.value = imgEl.value.naturalWidth
  imgNatH.value = imgEl.value.naturalHeight
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

function onWheel(e) {
  scale.value = Math.max(1, Math.min(3, scale.value + (e.deltaY > 0 ? -0.05 : 0.05)))
}

function startDrag(e) {
  dragging.value = true
  const pt = e.touches ? e.touches[0] : e
  dragStart.value = { x: pt.clientX, y: pt.clientY, ox: offsetX.value, oy: offsetY.value }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchmove', onDrag)
  window.addEventListener('touchend', stopDrag)
}

function onDrag(e) {
  if (!dragging.value) return
  const pt = e.touches ? e.touches[0] : e
  offsetX.value = dragStart.value.ox + (pt.clientX - dragStart.value.x)
  offsetY.value = dragStart.value.oy + (pt.clientY - dragStart.value.y)
}

function stopDrag() {
  dragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', stopDrag)
}

onUnmounted(() => {
  stopDrag()
})

function crop() {
  const canvas = document.createElement('canvas')
  const outputSize = 400
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')

  const img = imgEl.value
  // Compute displayed image dimensions
  let dispW, dispH
  if (imgNatW.value >= imgNatH.value) {
    dispH = CIRCLE_SIZE * scale.value
    dispW = (imgNatW.value / imgNatH.value) * dispH
  } else {
    dispW = CIRCLE_SIZE * scale.value
    dispH = (imgNatH.value / imgNatW.value) * dispW
  }

  // Image top-left in the crop area is centered + offset
  const imgLeft = (AREA_SIZE - dispW) / 2 + offsetX.value
  const imgTop = (AREA_SIZE - dispH) / 2 + offsetY.value

  // Circle top-left in the crop area
  const circleLeft = (AREA_SIZE - CIRCLE_SIZE) / 2
  const circleTop = (AREA_SIZE - CIRCLE_SIZE) / 2

  // The portion of the displayed image covered by the circle
  const srcXInDisp = circleLeft - imgLeft
  const srcYInDisp = circleTop - imgTop

  // Scale back to natural pixel coords
  const ratioX = imgNatW.value / dispW
  const ratioY = imgNatH.value / dispH

  ctx.beginPath()
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(
    img,
    srcXInDisp * ratioX,
    srcYInDisp * ratioY,
    CIRCLE_SIZE * ratioX,
    CIRCLE_SIZE * ratioY,
    0,
    0,
    outputSize,
    outputSize,
  )

  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      emit('crop', file, URL.createObjectURL(blob))
    }
  }, 'image/png')
}
</script>

<style scoped>
.cropper-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.cropper-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  width: 340px;
  max-width: 95vw;
}

.cropper-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  text-align: center;
}

.cropper-area {
  width: 280px;
  height: 280px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: #000;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.cropper-area:active {
  cursor: grabbing;
}

.cropper-img {
  position: absolute;
  pointer-events: none;
}

.cropper-circle {
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.cropper-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.75rem 0;
  padding: 0 0.5rem;
}

.zoom-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.zoom-slider {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}

.cropper-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.cropper-btn {
  padding: 0.45rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
}

.cropper-btn.cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.cropper-btn.cancel:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.cropper-btn.confirm {
  background: var(--accent);
  color: #fff;
}

.cropper-btn.confirm:hover {
  background: var(--accent-hover);
}
</style>
