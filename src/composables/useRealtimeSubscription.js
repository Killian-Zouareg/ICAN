import { onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'

/**
 * Composable pour s'abonner aux changements Supabase Realtime.
 *
 * @param {string} channelName — Préfixe unique du channel (ex: 'messages-conv-123')
 * @param {Array<{ event: string, table: string, schema?: string, filter?: string, callback: Function }>} subscriptions
 * @returns {{ subscribe: Function, unsubscribe: Function }}
 *
 * @example
 * const { subscribe, unsubscribe } = useRealtimeSubscription('feed', [
 *   { event: 'INSERT', table: 'posts', callback: (payload) => { ... } },
 *   { event: 'DELETE', table: 'posts', callback: (payload) => { ... } },
 * ])
 * onMounted(() => subscribe())
 */
export function useRealtimeSubscription(channelName, subscriptions) {
  let channel = null

  function subscribe() {
    unsubscribe()
    channel = supabase.channel(channelName + '-' + Date.now())

    for (const sub of subscriptions) {
      channel.on('postgres_changes', {
        event: sub.event,
        schema: sub.schema || 'public',
        table: sub.table,
        filter: sub.filter || undefined,
      }, sub.callback)
    }

    channel.subscribe()
  }

  async function unsubscribe() {
    if (channel) {
      const c = channel
      channel = null
      await supabase.removeChannel(c)
    }
  }

  onUnmounted(() => unsubscribe())

  return { subscribe, unsubscribe }
}
