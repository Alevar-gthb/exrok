import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { redirect } from 'next/navigation'
import { ApprovalRulesClient } from '@/components/approval-rules-client'

export const metadata = { title: 'Approval Rules | Exrok' }

export default async function ApprovalRulesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)

  if (me?.role !== 'owner') {
    redirect('/expenses')
  }

  const [{ data: rules }, { data: approvers }] = await Promise.all([
    supabase.from('approval_rules').select('*').order('priority', { ascending: true }),
    supabase.from('employees').select('id, full_name, email, role').in('role', ['owner', 'finance']).eq('status', 'Active').order('full_name'),
  ])

  return <ApprovalRulesClient initialRules={rules ?? []} approvers={approvers ?? []} />
}
