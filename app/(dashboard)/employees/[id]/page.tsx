import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
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

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
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
    .select('amount, salary_component_templates(kind, include_in_monthly_payroll)')
    .eq('employee_id', params.id)

  const compForSummary = (amountRows ?? []).map((r: Record<string, unknown>) => {
    const t = r.salary_component_templates as
      | { kind?: string; include_in_monthly_payroll?: boolean }
      | { kind?: string; include_in_monthly_payroll?: boolean }[]
      | null
    const tmpl = Array.isArray(t) ? t[0] : t
    const kind = tmpl?.kind ?? 'earning'
    const include_in_monthly_payroll = tmpl?.include_in_monthly_payroll !== false
    return { kind, amount: r.amount as string | number, include_in_monthly_payroll }
  })
  const { gross: grossSalary } = summarizeCompensationRows(compForSummary)

  const { data: salaryRows } = await supabase
    .from('expenses')
    .select('total_payment')
    .eq('employee_id', params.id)
    .eq('type', 'Salary')
    .in('status', ['Pending Approval', 'Approved', 'Paid'])

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
