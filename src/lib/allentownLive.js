// Service d'agrégation des APIs publiques pour la vraie ville d'Allentown, PA.
// Toutes les fonctions retournent des données normalisées ; en cas d'erreur, retournent null.

export const ALLENTOWN_COORDS = { lat: 40.6084, lng: -75.4902 }
export const ALLENTOWN_TZ = 'America/New_York'

const CACHE_PREFIX = 'allentownLive:'
const DEFAULT_TTL_MS = 15 * 60 * 1000

function readCache(key, ttlMs = DEFAULT_TTL_MS) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { at, value } = JSON.parse(raw)
    if (Date.now() - at > ttlMs) return null
    return value
  } catch {
    return null
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }))
  } catch {
    // quota exceeded — ignore
  }
}

export function clearAllentownCache() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}

// ---------- Météo (OpenWeatherMap) ----------

const OWM_KEY = import.meta.env.VITE_OPENWEATHER_KEY

export async function fetchWeather() {
  const cached = readCache('weather')
  if (cached) return cached

  if (!OWM_KEY) {
    return mockWeather()
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${ALLENTOWN_COORDS.lat}&lon=${ALLENTOWN_COORDS.lng}&units=metric&appid=${OWM_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('weather ' + res.status)
    const raw = await res.json()

    const value = {
      temp: Math.round(raw.main?.temp ?? 0),
      feels_like: Math.round(raw.main?.feels_like ?? 0),
      tempMin: Math.round(raw.main?.temp_min ?? 0),
      tempMax: Math.round(raw.main?.temp_max ?? 0),
      humidity: raw.main?.humidity ?? null,
      pressure: raw.main?.pressure ?? null,
      main: raw.weather?.[0]?.main ?? 'Clear',
      description: raw.weather?.[0]?.description ?? '',
      icon: raw.weather?.[0]?.icon ?? '01d',
      // OpenWeather avec units=metric retourne le vent en m/s — on convertit en km/h
      windSpeed: Math.round((raw.wind?.speed ?? 0) * 3.6),
      windGust: raw.wind?.gust ? Math.round(raw.wind.gust * 3.6) : null,
      clouds: raw.clouds?.all ?? 0,
      visibility: raw.visibility ?? null,
      sunrise: raw.sys?.sunrise ? raw.sys.sunrise * 1000 : null,
      sunset: raw.sys?.sunset ? raw.sys.sunset * 1000 : null,
      city: raw.name || 'Allentown',
      fetchedAt: Date.now(),
    }
    writeCache('weather', value)
    return value
  } catch (e) {
    console.warn('[allentownLive] fetchWeather failed:', e.message)
    return mockWeather()
  }
}

function mockWeather() {
  return {
    temp: 17, feels_like: 16, tempMin: 12, tempMax: 21,
    humidity: 55, pressure: 1015,
    main: 'Clouds', description: 'partiellement nuageux',
    icon: '03d', windSpeed: 8, windGust: null, clouds: 40, visibility: 10000,
    sunrise: null, sunset: null, city: 'Allentown',
    fetchedAt: Date.now(), _mock: true,
  }
}

// ---------- Forecast horaire ----------

export async function fetchForecast() {
  const cached = readCache('forecast', 30 * 60 * 1000)
  if (cached) return cached

  if (!OWM_KEY) return []

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${ALLENTOWN_COORDS.lat}&lon=${ALLENTOWN_COORDS.lng}&units=metric&cnt=12&appid=${OWM_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('forecast ' + res.status)
    const raw = await res.json()
    const value = (raw.list || []).map((it) => ({
      time: it.dt * 1000,
      temp: Math.round(it.main?.temp ?? 0),
      main: it.weather?.[0]?.main ?? 'Clear',
      icon: it.weather?.[0]?.icon ?? '01d',
      pop: Math.round((it.pop ?? 0) * 100),
    }))
    writeCache('forecast', value)
    return value
  } catch (e) {
    console.warn('[allentownLive] fetchForecast failed:', e.message)
    return []
  }
}

// ---------- Alertes NWS (gratuit, sans clé) ----------

export async function fetchAlerts() {
  const cached = readCache('alerts', 5 * 60 * 1000)
  if (cached) return cached

  try {
    const url = `https://api.weather.gov/alerts/active?point=${ALLENTOWN_COORDS.lat},${ALLENTOWN_COORDS.lng}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/geo+json', 'User-Agent': 'iCAN-Allentown (companion app)' },
    })
    if (!res.ok) throw new Error('nws ' + res.status)
    const raw = await res.json()
    const value = (raw.features || []).map((f) => ({
      id: f.id,
      event: f.properties?.event || 'Alerte',
      headline: f.properties?.headline || '',
      description: f.properties?.description || '',
      severity: f.properties?.severity || 'Unknown',
      urgency: f.properties?.urgency || 'Unknown',
      areaDesc: f.properties?.areaDesc || '',
      sent: f.properties?.sent,
      effective: f.properties?.effective,
      expires: f.properties?.expires,
      sender: f.properties?.senderName || 'NWS',
    }))
    writeCache('alerts', value)
    return value
  } catch (e) {
    console.warn('[allentownLive] fetchAlerts failed:', e.message)
    return []
  }
}

// ---------- Cycle solaire ----------

export async function fetchSunCycle() {
  const cached = readCache('sun', 6 * 60 * 60 * 1000)
  if (cached) return cached

  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${ALLENTOWN_COORDS.lat}&lng=${ALLENTOWN_COORDS.lng}&formatted=0`
    const res = await fetch(url)
    if (!res.ok) throw new Error('sun ' + res.status)
    const raw = await res.json()
    const r = raw.results || {}
    const value = {
      sunrise: r.sunrise ? new Date(r.sunrise).getTime() : null,
      sunset: r.sunset ? new Date(r.sunset).getTime() : null,
      solarNoon: r.solar_noon ? new Date(r.solar_noon).getTime() : null,
      dayLength: r.day_length || 0,
      civilDawn: r.civil_twilight_begin ? new Date(r.civil_twilight_begin).getTime() : null,
      civilDusk: r.civil_twilight_end ? new Date(r.civil_twilight_end).getTime() : null,
    }
    writeCache('sun', value)
    return value
  } catch (e) {
    console.warn('[allentownLive] fetchSunCycle failed:', e.message)
    return null
  }
}

// ---------- Phase lunaire (calcul direct) ----------

const MOON_PHASES = [
  { key: 'new',           label: 'Nouvelle lune',         emoji: '\u{1F311}' },
  { key: 'waxing_cresc',  label: 'Premier croissant',     emoji: '\u{1F312}' },
  { key: 'first_quarter', label: 'Premier quartier',      emoji: '\u{1F313}' },
  { key: 'waxing_gibb',   label: 'Lune gibbeuse croissante', emoji: '\u{1F314}' },
  { key: 'full',          label: 'Pleine lune',           emoji: '\u{1F315}' },
  { key: 'waning_gibb',   label: 'Lune gibbeuse décroissante', emoji: '\u{1F316}' },
  { key: 'last_quarter',  label: 'Dernier quartier',      emoji: '\u{1F317}' },
  { key: 'waning_cresc',  label: 'Dernier croissant',     emoji: '\u{1F318}' },
]

export function getMoonPhase(date = new Date()) {
  // Algorithme classique (Conway/Trapanese), précision ± 1 jour
  const yr = date.getUTCFullYear()
  const mo = date.getUTCMonth() + 1
  const dy = date.getUTCDate()
  let r = yr % 100
  r %= 19
  if (r > 9) r -= 19
  r = ((r * 11) % 30) + mo + dy
  if (mo < 3) r += 2
  r -= ((yr < 2000) ? 4 : 8.3)
  r = Math.floor(r + 0.5) % 30
  const age = r < 0 ? r + 30 : r // 0..29

  // index parmi 8 phases
  let idx
  if (age < 1)        idx = 0  // new
  else if (age < 7)   idx = 1  // waxing crescent
  else if (age < 8)   idx = 2  // first quarter
  else if (age < 14)  idx = 3  // waxing gibbous
  else if (age < 16)  idx = 4  // full
  else if (age < 22)  idx = 5  // waning gibbous
  else if (age < 23)  idx = 6  // last quarter
  else                idx = 7  // waning crescent

  const illum = Math.round((1 - Math.cos((age / 29.53) * 2 * Math.PI)) * 50)

  return {
    age,
    illumination: illum,
    ...MOON_PHASES[idx],
    isNotable: idx === 0 || idx === 4,
  }
}

// ---------- News locales (RSS via proxy CORS) ----------

const RSS_FEEDS = [
  { source: 'Lehigh Valley Live', url: 'https://www.lehighvalleylive.com/arc/outboundfeeds/rss/?outputType=xml' },
  { source: 'WFMZ-TV',            url: 'https://www.wfmz.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc' },
]

const RSS_PROXY = 'https://corsproxy.io/?'

export async function fetchLocalNews() {
  const cached = readCache('news', 30 * 60 * 1000)
  if (cached) return cached

  const all = []
  for (const feed of RSS_FEEDS) {
    try {
      const url = RSS_PROXY + encodeURIComponent(feed.url)
      const res = await fetch(url)
      if (!res.ok) continue
      const xml = await res.text()
      const items = parseRss(xml).slice(0, 8)
      for (const it of items) {
        all.push({ ...it, source: feed.source })
      }
    } catch (e) {
      console.warn('[allentownLive] fetchLocalNews', feed.source, 'failed:', e.message)
    }
  }
  // Tri par date desc, garder 12
  all.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
  const value = all.slice(0, 12)
  writeCache('news', value)
  return value
}

function parseRss(xml) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const items = []
    const nodes = doc.querySelectorAll('item, entry')
    nodes.forEach((node) => {
      const title = node.querySelector('title')?.textContent?.trim() || ''
      const link = node.querySelector('link')?.getAttribute('href')
        || node.querySelector('link')?.textContent?.trim() || ''
      const desc = node.querySelector('description, summary')?.textContent?.trim() || ''
      const pub = node.querySelector('pubDate, published, updated')?.textContent?.trim()
      let imageUrl = null
      const enclosure = node.querySelector('enclosure[url]')
      if (enclosure) imageUrl = enclosure.getAttribute('url')
      const mediaContent = node.querySelector('content[url], thumbnail[url]')
      if (!imageUrl && mediaContent) imageUrl = mediaContent.getAttribute('url')
      if (!imageUrl) {
        const m = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
        if (m) imageUrl = m[1]
      }
      items.push({
        title,
        link,
        description: stripHtml(desc).slice(0, 240),
        pubDate: pub ? new Date(pub).getTime() : Date.now(),
        imageUrl,
      })
    })
    return items
  } catch (e) {
    console.warn('[allentownLive] parseRss failed:', e.message)
    return []
  }
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// ---------- Événements (Ticketmaster Discovery) ----------

const TM_KEY = import.meta.env.VITE_TICKETMASTER_KEY

export async function fetchEvents() {
  const cached = readCache('events', 60 * 60 * 1000)
  if (cached) return cached

  if (!TM_KEY) return []

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?city=Allentown&stateCode=PA&size=20&sort=date,asc&apikey=${TM_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('ticketmaster ' + res.status)
    const raw = await res.json()
    const events = raw._embedded?.events || []
    const value = events.map((e) => ({
      id: e.id,
      name: e.name,
      url: e.url,
      date: e.dates?.start?.dateTime
        ? new Date(e.dates.start.dateTime).getTime()
        : (e.dates?.start?.localDate ? new Date(e.dates.start.localDate).getTime() : null),
      dateText: e.dates?.start?.localDate || '',
      timeText: e.dates?.start?.localTime || '',
      venue: e._embedded?.venues?.[0]?.name || '',
      city: e._embedded?.venues?.[0]?.city?.name || 'Allentown',
      classification: e.classifications?.[0]?.segment?.name || '',
      genre: e.classifications?.[0]?.genre?.name || '',
      image: pickEventImage(e.images),
    }))
    writeCache('events', value)
    return value
  } catch (e) {
    console.warn('[allentownLive] fetchEvents failed:', e.message)
    return []
  }
}

function pickEventImage(images) {
  if (!images?.length) return null
  // Préférer ratio 16:9 et largeur ≥ 640
  const ranked = [...images].sort((a, b) => {
    const aScore = (a.ratio === '16_9' ? 1000 : 0) + (a.width || 0)
    const bScore = (b.ratio === '16_9' ? 1000 : 0) + (b.width || 0)
    return bScore - aScore
  })
  return ranked[0]?.url || null
}

// ---------- Refresh global ----------

export async function refreshAll() {
  const [weather, forecast, alerts, sun, news, events] = await Promise.all([
    fetchWeather(),
    fetchForecast(),
    fetchAlerts(),
    fetchSunCycle(),
    fetchLocalNews(),
    fetchEvents(),
  ])
  return {
    weather,
    forecast,
    alerts,
    sun,
    moon: getMoonPhase(),
    news,
    events,
    lastFetch: Date.now(),
  }
}

// ---------- Helpers visuels ----------

export function isNightAt(timestamp, sun) {
  if (!sun || !sun.sunrise || !sun.sunset) {
    const h = new Date(timestamp).getHours()
    return h < 6 || h >= 20
  }
  return timestamp < sun.sunrise || timestamp > sun.sunset
}

export function weatherKindOf(weather) {
  if (!weather) return 'clear'
  const main = weather.main?.toLowerCase() || ''
  if (main.includes('thunder')) return 'thunderstorm'
  if (main.includes('drizzle')) return 'rain'
  if (main.includes('rain'))    return 'rain'
  if (main.includes('snow'))    return 'snow'
  if (main.includes('mist') || main.includes('fog') || main.includes('haze')) return 'fog'
  if (main.includes('cloud'))   return 'cloudy'
  return 'clear'
}

export function alertSeverityClass(severity) {
  const s = (severity || '').toLowerCase()
  if (s === 'extreme') return 'extreme'
  if (s === 'severe') return 'severe'
  if (s === 'moderate') return 'moderate'
  return 'minor'
}
