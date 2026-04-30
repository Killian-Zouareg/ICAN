import { computed } from 'vue'
import { useAllentownLiveStore } from '../stores/allentownLive'

export function useWeatherEffects() {
  const live = useAllentownLiveStore()
  live.ensureLoaded()

  const tileFilter = computed(() => {
    if (live.isNight) {
      return 'brightness(0.42) hue-rotate(220deg) contrast(1.15) saturate(0.8)'
    }
    switch (live.weatherKind) {
      case 'thunderstorm':
        return 'brightness(0.5) hue-rotate(260deg) contrast(1.25) saturate(0.7)'
      case 'rain':
        return 'brightness(0.62) saturate(0.5) contrast(1.1)'
      case 'snow':
        return 'brightness(1.12) saturate(0.2) contrast(0.92)'
      case 'fog':
        return 'blur(0.8px) brightness(0.85) saturate(0.4) contrast(0.9)'
      case 'cloudy':
        return 'brightness(0.78) saturate(0.7) contrast(1.05)'
      default:
        return null
    }
  })

  const ambientGradient = computed(() => {
    const kind = live.weatherKind
    const night = live.isNight
    if (night) {
      return 'linear-gradient(180deg, #0a1428 0%, #1a2540 60%, #2a3858 100%)'
    }
    switch (kind) {
      case 'thunderstorm':
        return 'linear-gradient(180deg, #1c1430 0%, #3a2c50 60%, #4a4060 100%)'
      case 'rain':
        return 'linear-gradient(180deg, #2c3848 0%, #455565 60%, #5a6c7c 100%)'
      case 'snow':
        return 'linear-gradient(180deg, #b8c8d8 0%, #d8e4ec 60%, #f0f4f8 100%)'
      case 'fog':
        return 'linear-gradient(180deg, #88909c 0%, #b0b8c0 60%, #c8d0d8 100%)'
      case 'cloudy':
        return 'linear-gradient(180deg, #6b7c90 0%, #8896a8 60%, #a4b0c0 100%)'
      default:
        return 'linear-gradient(180deg, #4a90e2 0%, #6dafe8 60%, #8fc4ee 100%)'
    }
  })

  const overlayHint = computed(() => ({
    rain: live.weatherKind === 'rain' || live.weatherKind === 'thunderstorm',
    snow: live.weatherKind === 'snow',
    fog: live.weatherKind === 'fog',
    lightning: live.weatherKind === 'thunderstorm',
  }))

  return {
    live,
    tileFilter,
    ambientGradient,
    overlayHint,
  }
}
