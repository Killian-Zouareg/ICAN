import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { checkRateLimit } from '../lib/rateLimit'

export const useBankStore = defineStore('bank', () => {
  const account = ref(null)
  const transactions = ref([])
  const loading = ref(false)
  const sending = ref(false)

  async function fetchAccount(profileId) {
    loading.value = true
    try {
      let { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error

      // Auto-create account if none exists
      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from('bank_accounts')
          .insert({ profile_id: profileId, balance: 0 })
          .select()
          .single()
        if (createErr) throw createErr
        data = created
      }

      account.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchTransactions(profileId) {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select(`
        *,
        sender:profiles!bank_transactions_sender_id_fkey(username, display_name, avatar_url),
        receiver:profiles!bank_transactions_receiver_id_fkey(username, display_name, avatar_url)
      `)
      .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    transactions.value = data || []
    return data
  }

  async function transfer(senderId, receiverId, amount, note = '') {
    const auth = useAuthStore()
    auth.checkBan()

    const rateLimitMsg = checkRateLimit('transfer')
    if (rateLimitMsg) throw new Error(rateLimitMsg)

    sending.value = true
    try {
      const { error } = await supabase.rpc('transfer_money', {
        p_sender_id: senderId,
        p_receiver_id: receiverId,
        p_amount: amount,
        p_note: note,
      })
      if (error) throw error

      // Refresh data
      await fetchAccount(senderId)
      await fetchTransactions(senderId)
    } finally {
      sending.value = false
    }
  }

  async function adminAdjustBalance(profileId, amount, note = '') {
    sending.value = true
    try {
      const { error } = await supabase.rpc('admin_adjust_balance', {
        p_profile_id: profileId,
        p_amount: amount,
        p_note: note,
      })
      if (error) throw error
    } finally {
      sending.value = false
    }
  }

  async function searchRecipient(query) {
    const auth = useAuthStore()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', auth.activeProfile?.id)
      .limit(10)
    if (error) throw error
    return data || []
  }

  return {
    account, transactions, loading, sending,
    fetchAccount, fetchTransactions, transfer, adminAdjustBalance, searchRecipient,
  }
})
