// ============================================================
// app/(dashboard)/expenses/new/page.tsx
// Server Component — fetch data lalu render ExpenseForm
// ============================================================
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'

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

  // Fetch data master untuk dropdown
  const [{ data: projects }, { data: employees }, { data: categories }, { data: subcategories }, { data: vendors }] = await Promise.all([
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
  ])

  return (
    <ExpenseForm
      projects={projects ?? []}
      employees={employees ?? []}
      categories={categories ?? []}
      subcategories={subcategories ?? []}
      vendors={vendors ?? []}
    />
  )
}
