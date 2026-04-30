import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchWeather, fetchForecast, fetchAlerts, fetchSunCycle,
  fetchLocalNews, fetchEvents, getMoonPhase,
  isNightAt, weatherKindOf, alertSeverityClass,
} from '../lib/allentownLive'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000

export const useAllentownLiveStore = defineStore('allentownLive', () => {
  const weather = ref(null)
  const forecast = ref([])
  const alerts = ref([])
  const sun = ref(null)
  const moon = ref(getMoonPhase())
  const news = ref([])
  const events = ref([])

  const lastFetch = ref(null)
  const loading = ref(false)
  const error = ref(null)

  let refreshTimer = null
  let initStarted = false

  const isNight = computed(() => {
    if (sun.value) return isNightAt(Date.now(), sun.value)
    const h = new Date().getHours()
    return h < 6 || h >= 20
  })

  const weatherKind = computed(() => weatherKindOf(weather.value))

  const severeAlerts = computed(() =>
    alerts.value.filter((a) => {
      const s = (a.severity || '').toLowerCase()
      return s === 'severe' || s === 'extreme'
    })
  )

  const hasSevereAlert = computed(() => severeAlerts.value.length > 0)

  const upcomingEvents = computed(() => {
    const now = Date.now()
    return events.value.filter((e) => !e.date || e.date >= now - 86400000).slice(0, 8)
  })

  async function refresh() {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const [w, fc, al, s, n, ev] = await Promise.all([
        fetchWeather(),
        fetchForecast(),
        fetchAlerts(),
        fetchSunCycle(),
        fetchLocalNews(),
        fetchEvents(),
      ])
      if (w) weather.value = w
      forecast.value = fc || []
      alerts.value = al || []
      if (s) sun.value = s
      moon.value = getMoonPhase()
      news.value = n || []
      events.value = ev || []
      lastFetch.value = Date.now()
    } catch (e) {
      console.error('[allentownLive store] refresh failed:', e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded() {
    if (initStarted) return
    initStarted = true
    refresh()
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(() => { refresh() }, REFRESH_INTERVAL_MS)
  }

  function stop() {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = null
    initStarted = false
  }

  function alertClass(a) {
    return alertSeverityClass(a?.severity)
  }

  return {
    weather, forecast, alerts, sun, moon, news, events,
    lastFetch, loading, error,
    isNight, weatherKind, severeAlerts, hasSevereAlert, upcomingEvents,
    refresh, ensureLoaded, stop, alertClass,
  }
})
