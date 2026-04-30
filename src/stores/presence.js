import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

// Map d'URL → identifiant de section utilisé pour les compteurs.
// L'ordre n'importe pas — on matche par longest-prefix.
const SECTION_MAP = {
  '/messages': 'messages',
  '/search': 'search',
  '/map': 'map',
  '/live': 'live',
  '/bank': 'bank',
  '/igames': 'igames',
  '/game': 'game',
  '/wiki': 'wiki',
  '/character': 'character',
  '/user': 'profile',
  '/settings': 'settings',
  '/patch-notes': 'patch-notes',
  '/admin': 'admin',
  '/post': 'feed',
  '/login': 'login',
}

export function pathToSection(path) {
  if (!path || path === '/') return 'feed'
  const sorted = Object.keys(SECTION_MAP).sort((a, b) => b.length - a.length)
  for (const prefix of sorted) {
    if (path === prefix || path.startsWith(prefix + '/')) return SECTION_MAP[prefix]
  }
  return 'feed'
}

export const usePresenceStore = defineStore('presence', () => {
  const counts = ref({})
  let channel = null
  let currentProfileId = null
  let currentSection = 'feed'

  function recompute() {
    if (!channel) return
    const state = channel.presenceState()
    const c = {}
    for (const key in state) {
      const metas = state[key]
      if (!metas || !metas.length) continue
      // Une seule présence par profil : on prend la dernière meta (la plus récente).
      const s = metas[metas.length - 1]?.section
      if (!s) continue
      c[s] = (c[s] || 0) + 1
    }
    counts.value = c
  }

  async function start(profileId) {
    if (!profileId) return
    if (channel && currentProfileId === profileId) return
    await stop()
    currentProfileId = profileId

    channel = supabase.channel('global-presence', {
      config: { presence: { key: profileId } },
    })

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await channel.track({ section: currentSection, profileId }) } catch { /* ignore */ }
        }
      })
  }

  async function stop() {
    if (channel) {
      try { await channel.unsubscribe() } catch { /* ignore */ }
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
      channel = null
    }
    currentProfileId = null
    counts.value = {}
  }

  async function setSection(section) {
    if (!section) return
    currentSection = section
    if (channel && currentProfileId) {
      try { await channel.track({ section, profileId: currentProfileId }) } catch { /* ignore */ }
    }
  }

  function countFor(section) {
    return counts.value[section] || 0
  }

  return { counts, start, stop, setSection, countFor }
})
