<template>
  <div class="weather-overlay" :class="overlayClasses" aria-hidden="true">
    <canvas ref="canvasEl" class="weather-canvas"></canvas>
    <div v-if="lightning" class="weather-lightning" :class="{ flashing: flashOn }"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWeatherEffects } from '../composables/useWeatherEffects'

const { overlayHint } = useWeatherEffects()

const canvasEl = ref(null)
const flashOn = ref(false)
let rafId = null
let particles = []
let lastFrame = 0
let lightningTimer = null
let resizeObserver = null

const rain = computed(() => overlayHint.value.rain)
const snow = computed(() => overlayHint.value.snow)
const fog = computed(() => overlayHint.value.fog)
const lightning = computed(() => overlayHint.value.lightning)

const overlayClasses = computed(() => ({
  'has-rain': rain.value,
  'has-snow': snow.value,
  'has-fog': fog.value,
  'has-lightning': lightning.value,
}))

function makeParticles(width, height) {
  if (rain.value) {
    const n = Math.floor((width * height) / 5500)
    return Array.from({ length: n }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vy: 9 + Math.random() * 7,
      vx: -1.5 - Math.random() * 1.5,
      len: 12 + Math.random() * 10,
      alpha: 0.3 + Math.random() * 0.4,
    }))
  }
  if (snow.value) {
    const n = Math.floor((width * height) / 8000)
    return Array.from({ length: n }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vy: 0.6 + Math.random() * 1.1,
      vx: -0.4 + Math.random() * 0.8,
      r: 1.5 + Math.random() * 2.5,
      alpha: 0.6 + Math.random() * 0.4,
      drift: Math.random() * Math.PI * 2,
    }))
  }
  return []
}

function resizeCanvas() {
  const c = canvasEl.value
  if (!c) return
  const rect = c.parentElement?.getBoundingClientRect()
  if (!rect) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = Math.floor(rect.width * dpr)
  c.height = Math.floor(rect.height * dpr)
  c.style.width = rect.width + 'px'
  c.style.height = rect.height + 'px'
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  particles = makeParticles(rect.width, rect.height)
}

function tick(t) {
  const c = canvasEl.value
  if (!c) return
  const ctx = c.getContext('2d')
  const w = c.width / (window.devicePixelRatio || 1)
  const h = c.height / (window.devicePixelRatio || 1)
  ctx.clearRect(0, 0, w, h)

  if (rain.value) {
    ctx.lineWidth = 1.2
    ctx.strokeStyle = 'rgba(180, 210, 240, 0.6)'
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + p.vx, p.y + p.len)
      ctx.stroke()
      p.x += p.vx
      p.y += p.vy
      if (p.y > h) { p.y = -10; p.x = Math.random() * w }
      if (p.x < -10) p.x = w + 10
    }
    ctx.globalAlpha = 1
  } else if (snow.value) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      p.drift += 0.02
      ctx.beginPath()
      ctx.arc(p.x + Math.sin(p.drift) * 0.8, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
      p.x += p.vx + Math.sin(p.drift) * 0.4
      p.y += p.vy
      if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w }
      if (p.x < -5) p.x = w + 5
      if (p.x > w + 5) p.x = -5
    }
    ctx.globalAlpha = 1
  }

  rafId = requestAnimationFrame(tick)
  lastFrame = t
}

function startLightning() {
  stopLightning()
  const schedule = () => {
    const wait = 4000 + Math.random() * 12000
    lightningTimer = setTimeout(() => {
      flashOn.value = true
      setTimeout(() => { flashOn.value = false }, 90)
      setTimeout(() => { flashOn.value = true }, 180)
      setTimeout(() => { flashOn.value = false }, 260)
      schedule()
    }, wait)
  }
  schedule()
}

function stopLightning() {
  if (lightningTimer) clearTimeout(lightningTimer)
  lightningTimer = null
  flashOn.value = false
}

watch([rain, snow], () => {
  resizeCanvas()
})

watch(lightning, (on) => {
  if (on) startLightning()
  else stopLightning()
}, { immediate: false })

onMounted(() => {
  resizeCanvas()
  rafId = requestAnimationFrame(tick)
  if (lightning.value) startLightning()
  if (window.ResizeObserver && canvasEl.value?.parentElement) {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasEl.value.parentElement)
  }
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  stopLightning()
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped src="./WeatherOverlay.css"></style>
