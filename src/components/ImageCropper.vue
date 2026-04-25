<template>
  <div class="cropper-overlay" @click.self="$emit('cancel')">
    <div class="cropper-modal">
      <h3 class="cropper-title">{{ title }}</h3>
      <div class="cropper-area" ref="cropArea"
        @mousedown="startDrag" @touchstart.prevent="startDrag"
        @wheel.prevent="onWheel"
      >
        <img ref="imgEl" :src="src" class="cropper-img"
          :style="imgStyle" draggable="false" @load="onImgLoad" />
        <div :class="shape === 'square' ? 'cropper-square' : 'cropper-circle'"></div>
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
  shape: { type: String, default: 'circle' }, // 'circle' | 'square'
  title: { type: String, default: 'Recadrer la photo de profil' },
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

  if (props.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
  }

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

<style scoped src="./ImageCropper.css"></style>
