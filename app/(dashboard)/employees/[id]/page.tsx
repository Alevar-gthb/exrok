import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { EmployeeDetailClient } from '@/components/employee-detail-client'
import Decimal from 'decimal.js'
import { summarizeCompensationRows } from '@/lib/compensation-summary'

export const metadata = { title: 'Detail Karyawan | Exrok' }

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!me || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, full_name, status, nip, job_title, is_permanent')
    .eq('id', params.id)
    .single()

  if (!employee) notFound()

  const { data: amountRows } = await supabase
    .from('employee_salary_component_amounts')
    .select('amount, salary_component_templates(kind)')
    .eq('employee_id', params.id)

  const compForSummary = (amountRows ?? []).map((r: Record<string, unknown>) => {
    const t = r.salary_component_templates as { kind?: string } | { kind?: string }[] | null
    const kind = (Array.isArray(t) ? t[0]?.kind : t?.kind) ?? 'earning'
    return { kind, amount: r.amount as string | number }
  })
  const { gross: grossSalary } = summarizeCompensationRows(compForSummary)

  const { data: salaryRows } = await supabase
    .from('expenses')
    .select('total_payment')
    .eq('employee_id', params.id)
    .eq('type', 'Salary')
    .in('status', ['Submitted', 'Pending Approval', 'Approved', 'Paid'])

  const totalPaidFromExpenses = (salaryRows ?? []).reduce((acc, row: { total_payment: string | number }) => {
    const v = typeof row.total_payment === 'string' ? row.total_payment : String(row.total_payment)
    return acc.plus(new Decimal(v || '0'))
  }, new Decimal('0'))

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('status', 'Active')
    .order('name')

  return (
    <EmployeeDetailClient
      employeeId={params.id}
      initialEmployee={employee}
      initialGrossSalary={grossSalary.toFixed(2)}
      initialSalaryPaidFromExpenses={totalPaidFromExpenses.toFixed(2)}
      myRole={me.role}
      initialProjects={projects ?? []}
    />
  )
}
