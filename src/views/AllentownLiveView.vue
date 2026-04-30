<template>
  <div class="alv" :style="{ background: ambientGradient }" :class="{ 'alv-night': live.isNight }">
    <!-- Animated overlay (rain/snow/lightning) -->
    <WeatherOverlay class="alv-overlay" />

    <div class="alv-content">
      <!-- Top bar -->
      <div class="alv-topbar">
        <button class="alv-back" @click="$router.back()">&larr;</button>
        <div class="alv-top-title">
          <span class="alv-pin">📍</span>
          <span>Allentown, PA</span>
        </div>
        <button class="alv-refresh" :class="{ spinning: live.loading }" @click="live.refresh()" title="Rafraichir">↻</button>
      </div>

      <!-- Hero block -->
      <section class="alv-hero">
        <div class="alv-time-block">
          <div class="alv-clock">{{ localClock }}</div>
          <div class="alv-date">{{ localDate }}</div>
        </div>

        <div v-if="live.weather" class="alv-hero-main">
          <div class="alv-hero-icon">{{ heroEmoji }}</div>
          <div class="alv-hero-temp">
            {{ live.weather.temp }}<span class="alv-deg">°</span>
          </div>
          <div class="alv-hero-cond">{{ frenchCondition }}</div>
          <div class="alv-hero-feels">
            Min {{ live.weather.tempMin }}° · Max {{ live.weather.tempMax }}° · ressenti {{ live.weather.feels_like }}°
          </div>
        </div>

        <div v-else-if="live.loading" class="alv-hero-loading">
          <div class="alv-spinner"></div>
        </div>
      </section>

      <!-- Active alerts -->
      <section v-if="live.alerts.length > 0" class="alv-alerts">
        <h3 class="alv-section-title">🚨 Alertes actives</h3>
        <div class="alv-alert-list">
          <div
            v-for="a in live.alerts"
            :key="a.id"
            class="alv-alert"
            :class="'alv-alert-' + live.alertClass(a)"
          >
            <div class="alv-alert-head">
              <strong>{{ a.event }}</strong>
              <span class="alv-alert-sev">{{ a.severity }}</span>
            </div>
            <div class="alv-alert-headline">{{ a.headline }}</div>
            <div v-if="a.areaDesc" class="alv-alert-area">📍 {{ a.areaDesc }}</div>
            <div v-if="a.expires" class="alv-alert-expires">
              Valide jusqu'au {{ formatDateTime(a.expires) }}
            </div>
            <details v-if="a.description" class="alv-alert-detail">
              <summary>Détails complets</summary>
              <p>{{ a.description }}</p>
            </details>
          </div>
        </div>
      </section>

      <!-- Hourly forecast -->
      <section v-if="live.forecast.length > 0" class="alv-forecast">
        <h3 class="alv-section-title">🕒 Prochaines heures</h3>
        <div class="alv-forecast-row">
          <div v-for="(f, i) in live.forecast" :key="i" class="alv-fc-card">
            <div class="alv-fc-time">{{ formatHour(f.time) }}</div>
            <div class="alv-fc-icon">{{ forecastEmoji(f.main) }}</div>
            <div class="alv-fc-temp">{{ f.temp }}°</div>
            <div v-if="f.pop > 10" class="alv-fc-pop">💧 {{ f.pop }}%</div>
          </div>
        </div>
      </section>

      <!-- Sun & moon detail -->
      <section class="alv-celestial">
        <div v-if="live.sun" class="alv-cel-card">
          <h4 class="alv-cel-title">🌅 Soleil</h4>
          <div class="alv-cel-row">
            <span>Lever</span>
            <strong>{{ formatTime(live.sun.sunrise) }}</strong>
          </div>
          <div class="alv-cel-row">
            <span>Coucher</span>
            <strong>{{ formatTime(live.sun.sunset) }}</strong>
          </div>
          <div v-if="live.sun.dayLength" class="alv-cel-row">
            <span>Durée du jour</span>
            <strong>{{ formatDuration(live.sun.dayLength) }}</strong>
          </div>
        </div>
        <div v-if="live.moon" class="alv-cel-card">
          <h4 class="alv-cel-title">{{ live.moon.emoji }} Lune</h4>
          <div class="alv-cel-row">
            <span>Phase</span>
            <strong>{{ live.moon.label }}</strong>
          </div>
          <div class="alv-cel-row">
            <span>Illumination</span>
            <strong>{{ live.moon.illumination }}%</strong>
          </div>
          <div class="alv-cel-row" v-if="live.moon.isNotable">
            <span class="alv-cel-notable">⭐ Phase notable cette nuit</span>
          </div>
        </div>
      </section>

      <!-- News -->
      <section v-if="live.news.length > 0" class="alv-news">
        <h3 class="alv-section-title">📰 Allentown — vraies news locales</h3>
        <div class="alv-news-grid">
          <a
            v-for="(n, i) in live.news"
            :key="i"
            :href="n.link"
            target="_blank"
            rel="noopener"
            class="alv-news-card"
          >
            <div v-if="n.imageUrl" class="alv-news-image-wrap">
              <img :src="n.imageUrl" :alt="n.title" loading="lazy" />
            </div>
            <div class="alv-news-body">
              <div class="alv-news-source">{{ n.source }} · {{ formatRelative(n.pubDate) }}</div>
              <h4 class="alv-news-title">{{ n.title }}</h4>
              <p v-if="n.description" class="alv-news-desc">{{ n.description }}</p>
            </div>
          </a>
        </div>
      </section>

      <!-- Events -->
      <section v-if="live.events.length > 0" class="alv-events">
        <h3 class="alv-section-title">🎫 À venir à Allentown</h3>
        <div class="alv-events-grid">
          <a
            v-for="ev in live.events"
            :key="ev.id"
            :href="ev.url"
            target="_blank"
            rel="noopener"
            class="alv-event-card"
          >
            <div v-if="ev.image" class="alv-event-image-wrap">
              <img :src="ev.image" :alt="ev.name" loading="lazy" />
            </div>
            <div class="alv-event-body">
              <div class="alv-event-cat">{{ classificationEmoji(ev) }} {{ ev.classification || 'Événement' }}</div>
              <h4 class="alv-event-name">{{ ev.name }}</h4>
              <div class="alv-event-meta">
                <span v-if="ev.dateText">📅 {{ formatEventDate(ev.dateText) }}</span>
                <span v-if="ev.timeText"> · {{ ev.timeText.slice(0, 5) }}</span>
              </div>
              <div v-if="ev.venue" class="alv-event-venue">📍 {{ ev.venue }}</div>
            </div>
          </a>
        </div>
      </section>

      <!-- Footer info -->
      <section class="alv-footer">
        <p class="alv-footer-text">
          Données réelles d'Allentown, PA — météo
          <span v-if="!isMockWeather"> via OpenWeatherMap</span>
          <span v-else class="alv-mock-badge">données simulées</span>
          · alertes via NWS · news via flux locaux · événements via Ticketmaster
        </p>
        <p class="alv-footer-text" v-if="live.lastFetch">
          Dernière mise à jour : {{ formatRelative(live.lastFetch) }}
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAllentownLiveStore } from '../stores/allentownLive'
import { useWeatherEffects } from '../composables/useWeatherEffects'
import WeatherOverlay from '../components/WeatherOverlay.vue'

const live = useAllentownLiveStore()
const { ambientGradient } = useWeatherEffects()
live.ensureLoaded()

const now = ref(Date.now())
let clockTimer = null
onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const localClock = computed(() =>
  new Date(now.value).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
)
const localDate = computed(() =>
  new Date(now.value).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/New_York',
  })
)

const isMockWeather = computed(() => live.weather?._mock === true)

const FRENCH_CONDITIONS = {
  Clear: 'Ciel dégagé', Clouds: 'Nuageux', Rain: 'Pluvieux',
  Drizzle: 'Bruine', Thunderstorm: 'Orage', Snow: 'Neige',
  Mist: 'Brume', Fog: 'Brouillard épais', Haze: 'Voile de brume',
  Smoke: 'Air enfumé', Dust: 'Poussière', Tornado: 'TORNADE',
}

const frenchCondition = computed(() => {
  if (!live.weather) return ''
  return FRENCH_CONDITIONS[live.weather.main] || live.weather.description
})

const WEATHER_EMOJI = {
  Clear: '\u{2600}\u{FE0F}', Clouds: '\u{2601}\u{FE0F}', Rain: '\u{1F327}\u{FE0F}',
  Drizzle: '\u{1F326}\u{FE0F}', Thunderstorm: '\u{26C8}\u{FE0F}', Snow: '\u{1F328}\u{FE0F}',
  Mist: '\u{1F32B}\u{FE0F}', Fog: '\u{1F32B}\u{FE0F}', Haze: '\u{1F32B}\u{FE0F}',
  Smoke: '\u{1F32B}\u{FE0F}', Dust: '\u{1F32B}\u{FE0F}', Tornado: '\u{1F32A}\u{FE0F}',
}

const heroEmoji = computed(() => {
  if (!live.weather) return '\u{1F324}\u{FE0F}'
  if (live.isNight && live.weather.main === 'Clear') return '\u{1F319}'
  return WEATHER_EMOJI[live.weather.main] || '\u{1F324}\u{FE0F}'
})

function forecastEmoji(main) {
  return WEATHER_EMOJI[main] || '\u{1F324}\u{FE0F}'
}

function classificationEmoji(ev) {
  if (ev.classification === 'Sports') return '\u{26BD}'
  if (ev.classification === 'Music') return '\u{1F3B5}'
  if (ev.classification === 'Arts & Theatre') return '\u{1F3AD}'
  if (ev.classification === 'Family') return '\u{1F3A1}'
  return '\u{1F3AB}'
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
}

function formatHour(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', timeZone: 'America/New_York',
  }) + 'h'
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
  })
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return 'à l\'instant'
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`
  return `il y a ${Math.floor(diff / 86400000)} j`
}
</script>

<style scoped src="./AllentownLiveView.css"></style>
