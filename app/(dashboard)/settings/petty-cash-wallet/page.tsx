import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { PettyCashWalletClient } from '@/components/petty-cash-wallet-client'

export const metadata = { title: 'Petty Cash Wallet | Exrok' }

export default async function PettyCashWalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
    redirect('/dashboard')
  }

  const { data: balanceRpc, error: balanceErr } = await supabase.rpc('get_petty_cash_balance')
  if (balanceErr) {
    throw new Error(balanceErr.message)
  }

  const parsedBalance = balanceRpc as { success?: boolean; message?: string; wallet_id?: string; balance?: string | number }
  if (parsedBalance.success === false || !parsedBalance.wallet_id) {
    throw new Error(parsedBalance.message ?? 'Gagal mengambil wallet petty cash')
  }

  const { data: entries, error: entriesErr } = await supabase
    .from('petty_cash_wallet_entries')
    .select('id, wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, notes, created_by, created_at')
    .eq('wallet_id', parsedBalance.wallet_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200)
  if (entriesErr) throw new Error(entriesErr.message)

  return <PettyCashWalletClient balance={String(parsedBalance.balance ?? '0')} entries={entries ?? []} />
}
