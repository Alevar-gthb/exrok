// ============================================================
// app/(dashboard)/expenses/new/page.tsx
// Server Component — fetch data lalu render ExpenseForm
// ============================================================
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import { fetchMySessionEmployee } from '@/lib/employee-session'

export const metadata = {
  title: 'Pengajuan Expense Baru | Roketin Ops',
}

export default async function NewExpensePage() {
  const supabase = await createClient()

  // Guard: pastikan user sudah login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const me = await fetchMySessionEmployee(supabase)
  const canViewPettyCashBalance = Boolean(me?.role && ['owner', 'finance'].includes(me.role))

  // Fetch data master untuk dropdown
  const [{ data: projects }, { data: employees }, { data: categories }, { data: subcategories }, { data: vendors }, walletBalanceRpc] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, client_name, status')
      .eq('status', 'Active')
      .order('name'),
    supabase
      .from('employees')
      .select('id, full_name, email, nip, job_title, role, status, created_at')
      .eq('status', 'Active')
      .order('full_name'),
    supabase.from('expense_categories').select('id, name').order('name'),
    supabase.from('expense_subcategories').select('id, category_id, name').order('name'),
    supabase.from('vendors').select('id, name').order('name'),
    canViewPettyCashBalance ? supabase.rpc('get_petty_cash_balance') : Promise.resolve({ data: null }),
  ])
  const walletBalance =
    walletBalanceRpc && typeof walletBalanceRpc === 'object' && 'data' in walletBalanceRpc
      ? ((walletBalanceRpc.data as { success?: boolean; balance?: string | number } | null)?.success
          ? String((walletBalanceRpc.data as { balance?: string | number }).balance ?? '0')
          : null)
      : null

  return (
    <ExpenseForm
      projects={projects ?? []}
      employees={employees ?? []}
      categories={categories ?? []}
      subcategories={subcategories ?? []}
      vendors={vendors ?? []}
      canViewPettyCashBalance={canViewPettyCashBalance}
      pettyCashMaxAmount={walletBalance}
    />
  )
}
