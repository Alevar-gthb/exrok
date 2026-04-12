import { createClient } from '@/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseDetailClient } from '@/components/expense-detail-client'

export const metadata = { title: 'Detail Expense | Exrok' }

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('id, role')
    .eq('email', user.email ?? '')
    .single()

  if (!me) redirect('/login')

  const { data: expense, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      ref_no,
      transaction_date,
      type,
      description,
      amount,
      vat,
      admin_fee,
      service_fee,
      total_payment,
      status,
      business_unit,
      department,
      payment_method,
      due_date,
      payment_date,
      document_url,
      created_by,
      project:projects(id, name, client_name),
      employee:employees(id, full_name, email),
      vendor:vendors(id, name),
      category:expense_categories(id, name),
      subcategory:expense_subcategories(id, name)
    `
    )
    .eq('id', params.id)
    .single()

  if (error || !expense) notFound()

  const { data: approvals } = await supabase
    .from('expense_approvals')
    .select(
      `
      id,
      approver_employee_id,
      status,
      notes,
      approved_at,
      created_at,
      approval_rule:approval_rules(id, name),
      approver:employees(id, full_name, email)
    `
    )
    .eq('expense_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <div style={{ padding: '8px 0 32px' }}>
      <ExpenseDetailClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expense={expense as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        approvals={(approvals ?? []) as any}
        userId={user.id}
        userRole={me.role ?? 'staff'}
        myEmployeeId={me.id}
      />
    </div>
  )
}
