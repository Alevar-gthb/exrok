'use server'

import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import type { ActionResult } from '@/lib/actions/expense.actions'
import type { PettyCashWalletEntry } from '@/types/database.types'

const PRIVILEGED_ROLES = new Set(['owner', 'finance'])

function isPrivileged(role: string | null | undefined): boolean {
  return Boolean(role && PRIVILEGED_ROLES.has(role))
}

export async function getPettyCashWalletSnapshot(
  limit = 50
): Promise<ActionResult<{ balance: string; entries: PettyCashWalletEntry[] }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const me = await fetchMySessionEmployee(supabase)
  if (!isPrivileged(me?.role)) {
    return { success: false, error: 'Akses wallet petty cash ditolak' }
  }

  const { data: walletData, error: walletErr } = await supabase.rpc('get_petty_cash_balance')
  if (walletErr) return { success: false, error: walletErr.message }

  const walletRow = walletData as { success?: boolean; message?: string; wallet_id?: string; balance?: string | number }
  if (walletRow.success === false) return { success: false, error: walletRow.message ?? 'Gagal mengambil saldo wallet' }

  const walletId = walletRow.wallet_id
  if (!walletId) return { success: false, error: 'Wallet petty cash tidak ditemukan' }

  const { data: entries, error: entriesErr } = await supabase
    .from('petty_cash_wallet_entries')
    .select('id, wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, notes, created_by, created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))
  if (entriesErr) return { success: false, error: entriesErr.message }

  return {
    success: true,
    data: {
      balance: String(walletRow.balance ?? '0'),
      entries: (entries ?? []) as PettyCashWalletEntry[],
    },
  }
}

export async function topupPettyCashWallet(input: {
  amount: string
  notes?: string | null
}): Promise<ActionResult<{ balance_before: string; balance_after: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const me = await fetchMySessionEmployee(supabase)
  if (!isPrivileged(me?.role)) {
    return { success: false, error: 'Akses top-up petty cash ditolak' }
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Nominal top-up harus lebih besar dari 0' }
  }

  const { data, error } = await supabase.rpc('topup_petty_cash_wallet', {
    p_amount: amount,
    p_notes: input.notes?.trim() || null,
  })
  if (error) return { success: false, error: error.message }

  const row = data as {
    success?: boolean
    message?: string
    balance_before?: string | number
    balance_after?: string | number
  }
  if (row.success === false) return { success: false, error: row.message ?? 'Gagal top-up wallet petty cash' }

  return {
    success: true,
    data: {
      balance_before: String(row.balance_before ?? '0'),
      balance_after: String(row.balance_after ?? '0'),
    },
  }
}

export async function getPettyCashSpendLimit(): Promise<ActionResult<{ maxAmount: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase.rpc('get_petty_cash_balance')
  if (error) return { success: false, error: error.message }
  const row = data as { success?: boolean; code?: string; message?: string; balance?: string | number }

  if (row.success === false) {
    if (row.code === 'FORBIDDEN') {
      return { success: false, error: 'Akses wallet petty cash ditolak' }
    }
    return { success: false, error: row.message ?? 'Gagal mengambil saldo wallet petty cash' }
  }

  return { success: true, data: { maxAmount: String(row.balance ?? '0') } }
}
