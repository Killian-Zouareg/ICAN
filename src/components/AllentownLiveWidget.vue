<template>
  <div class="alw" :class="[`alw-${live.weatherKind}`, { 'alw-night': live.isNight }]">
    <!-- Header -->
    <div class="alw-head">
      <div class="alw-head-left">
        <span class="alw-loc-pin">📍</span>
        <span class="alw-loc">Allentown, PA</span>
      </div>
      <span class="alw-time">{{ localTime }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="!live.weather && live.loading" class="alw-skeleton">
      <div class="alw-skel-temp"></div>
      <div class="alw-skel-line"></div>
    </div>

    <!-- Severe alert ribbon -->
    <router-link
      v-if="live.hasSevereAlert"
      to="/live"
      class="alw-alert-ribbon"
      :class="alertClass"
    >
      <span class="alw-alert-icon">🚨</span>
      <div class="alw-alert-text">
        <span class="alw-alert-title">{{ topAlert.event }}</span>
        <span class="alw-alert-headline">{{ truncated(topAlert.headline, 60) }}</span>
      </div>
    </router-link>

    <!-- Main weather block -->
    <router-link to="/live" class="alw-main" v-if="live.weather">
      <div class="alw-main-left">
        <div class="alw-icon">{{ weatherEmoji }}</div>
        <div class="alw-cond">{{ frenchCondition }}</div>
      </div>
      <div class="alw-main-right">
        <div class="alw-temp">{{ live.weather.temp }}<span class="alw-deg">°</span></div>
        <div class="alw-feels">ressenti {{ live.weather.feels_like }}°C</div>
      </div>
    </router-link>

    <!-- Min/max + wind -->
    <div v-if="live.weather" class="alw-meta">
      <span class="alw-meta-item">
        <span class="alw-meta-icon">↓</span>{{ live.weather.tempMin }}°
        <span class="alw-meta-sep">·</span>
        <span class="alw-meta-icon">↑</span>{{ live.weather.tempMax }}°
      </span>
      <span class="alw-meta-item" v-if="live.weather.windSpeed">
        <span class="alw-meta-icon">💨</span>{{ live.weather.windSpeed }} km/h
      </span>
      <span class="alw-meta-item" v-if="live.weather.humidity">
        <span class="alw-meta-icon">💧</span>{{ live.weather.humidity }}%
      </span>
    </div>

    <!-- Sun + moon row -->
    <div class="alw-row" v-if="live.sun || live.moon">
      <div class="alw-row-item" v-if="live.sun?.sunrise">
        <span class="alw-row-emoji">🌅</span>
        <span>{{ formatTime(live.sun.sunrise) }}</span>
      </div>
      <div class="alw-row-item" v-if="live.sun?.sunset">
        <span class="alw-row-emoji">🌇</span>
        <span>{{ formatTime(live.sun.sunset) }}</span>
      </div>
      <div class="alw-row-item" v-if="live.moon">
        <span class="alw-row-emoji">{{ live.moon.emoji }}</span>
        <span>{{ live.moon.illumination }}%</span>
      </div>
    </div>

    <!-- News snippet -->
    <div v-if="live.news?.length" class="alw-section">
      <div class="alw-section-head">
        <span class="alw-section-title">📰 À la une</span>
        <router-link to="/live" class="alw-section-more">voir tout</router-link>
      </div>
      <a
        v-for="(n, i) in live.news.slice(0, 2)"
        :key="i"
        :href="n.link"
        target="_blank"
        rel="noopener"
        class="alw-news-item"
      >
        <span class="alw-news-title">{{ truncated(n.title, 80) }}</span>
        <span class="alw-news-source">{{ n.source }}</span>
      </a>
    </div>

    <!-- Events snippet -->
    <div v-if="live.upcomingEvents?.length" class="alw-section">
      <div class="alw-section-head">
        <span class="alw-section-title">🎫 À venir</span>
        <router-link to="/live" class="alw-section-more">voir tout</router-link>
      </div>
      <a
        v-for="ev in live.upcomingEvents.slice(0, 2)"
        :key="ev.id"
        :href="ev.url"
        target="_blank"
        rel="noopener"
        class="alw-event-item"
      >
        <span class="alw-event-name">{{ truncated(ev.name, 50) }}</span>
        <span class="alw-event-when">{{ formatEventDate(ev.dateText) }} · {{ ev.venue }}</span>
      </a>
    </div>

    <!-- Footer link to full page -->
    <router-link to="/live" class="alw-footer-link">Ouvrir Live Allentown →</router-link>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAllentownLiveStore } from '../stores/allentownLive'

const live = useAllentownLiveStore()
live.ensureLoaded()

const now = ref(Date.now())
let clockTimer = null

onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 30000)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const localTime = computed(() => {
  return new Date(now.value).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
})

const WEATHER_EMOJI = {
  Clear: '\u{2600}\u{FE0F}', Clouds: '\u{2601}\u{FE0F}', Rain: '\u{1F327}\u{FE0F}',
  Drizzle: '\u{1F326}\u{FE0F}', Thunderstorm: '\u{26C8}\u{FE0F}', Snow: '\u{1F328}\u{FE0F}',
  Mist: '\u{1F32B}\u{FE0F}', Fog: '\u{1F32B}\u{FE0F}', Haze: '\u{1F32B}\u{FE0F}',
  Smoke: '\u{1F32B}\u{FE0F}', Dust: '\u{1F32B}\u{FE0F}', Tornado: '\u{1F32A}\u{FE0F}',
}

const weatherEmoji = computed(() => {
  if (!live.weather) return '\u{1F324}\u{FE0F}'
  if (live.isNight && live.weather.main === 'Clear') return '\u{1F319}'
  return WEATHER_EMOJI[live.weather.main] || '\u{1F324}\u{FE0F}'
})

const FRENCH_CONDITIONS = {
  Clear: 'Dégagé', Clouds: 'Nuageux', Rain: 'Pluie',
  Drizzle: 'Bruine', Thunderstorm: 'Orage', Snow: 'Neige',
  Mist: 'Brume', Fog: 'Brouillard', Haze: 'Voile',
  Smoke: 'Fumée', Dust: 'Poussière', Tornado: 'TORNADE',
}

const frenchCondition = computed(() => {
  if (!live.weather) return ''
  return FRENCH_CONDITIONS[live.weather.main] || live.weather.description
})

const topAlert = computed(() => live.severeAlerts[0] || live.alerts[0])

const alertClass = computed(() => 'alw-alert-' + live.alertClass(topAlert.value))

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function truncated(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<style scoped src="./AllentownLiveWidget.css"></style>
