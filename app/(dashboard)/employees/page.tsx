import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { EmployeesListClient, type EmployeeListRow } from './employees-list-client'
import { summarizeCompensationRows } from '@/lib/compensation-summary'

export const metadata = { title: 'Karyawan | Exrok' }

export default async function EmployeesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!me || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  const { data: emps } = await supabase
    .from('employees')
    .select('id, full_name, nip, job_title, status')
    .order('full_name')

  const { data: compRows } = await supabase
    .from('employee_salary_component_amounts')
    .select('employee_id, amount, salary_component_templates(kind)')

  const byEmp = new Map<string, { kind: string; amount: string | number }[]>()
  for (const c of compRows ?? []) {
    const t = c.salary_component_templates as { kind?: string } | { kind?: string }[] | null
    const kind = (Array.isArray(t) ? t[0]?.kind : t?.kind) ?? 'earning'
    const list = byEmp.get(c.employee_id) ?? []
    list.push({ kind, amount: c.amount })
    byEmp.set(c.employee_id, list)
  }

  const rows: EmployeeListRow[] = (emps ?? []).map(e => {
    const s = summarizeCompensationRows(byEmp.get(e.id) ?? [])
    return {
      id: e.id,
      nip: e.nip,
      full_name: e.full_name,
      job_title: e.job_title,
      status: e.status,
      gross_salary: s.gross,
      total_deduction: s.deductions,
      net_salary: s.net,
    }
  })

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>Karyawan</h1>
      <EmployeesListClient initialRows={rows} myRole={me.role} />
    </div>
  )
}
