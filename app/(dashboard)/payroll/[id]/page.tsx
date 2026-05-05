import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { PayrollRunDetailClient, type PayrollLineRow } from '@/components/payroll-run-detail-client'
import type { PayrollRun } from '@/types/database.types'

export const metadata = { title: 'Detail Payroll | Exrok' }

export default async function PayrollRunPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  const { data: run } = await supabase.from('payroll_runs').select('*').eq('id', params.id).single()
  if (!run) notFound()

  const { data: rawLines } = await supabase
    .from('payroll_run_lines')
    .select('*, employee:employees(full_name)')
    .eq('run_id', params.id)
    .order('created_at')

  const initialLines = (rawLines ?? []) as PayrollLineRow[]

  const { data: projects } = await supabase.from('projects').select('id, name').eq('status', 'Active').order('name')

  return (
    <PayrollRunDetailClient
      initialRun={run as PayrollRun}
      initialLines={initialLines}
      projects={projects ?? []}
      myRole={me.role}
    />
  )
}
