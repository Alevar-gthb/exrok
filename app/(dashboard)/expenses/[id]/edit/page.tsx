import { createClient } from '@/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import type { ExpenseFormValues } from '@/lib/validations/expense.schema'

export const metadata = { title: 'Edit Expense | Exrok' }

export default async function EditExpensePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expense, error } = await supabase.from('expenses').select('*').eq('id', params.id).single()

  if (error || !expense) notFound()

  if (expense.created_by !== user.id || !['Draft', 'Rejected'].includes(expense.status)) {
    redirect(`/expenses/${params.id}`)
  }

  const [{ data: projects }, { data: employees }] = await Promise.all([
    supabase.from('projects').select('id, name, client_name, status').eq('status', 'Active').order('name'),
    supabase.from('employees').select('id, full_name, email, nip, job_title, role, status, created_at').eq('status', 'Active').order('full_name'),
  ])

  const initialValues: Partial<ExpenseFormValues> = {
    transaction_date: expense.transaction_date,
    type: expense.type as ExpenseFormValues['type'],
    description: expense.description ?? '',
    project_id: expense.project_id ?? '',
    employee_id: expense.employee_id ?? '',
    amount: expense.amount,
    vat: expense.vat ?? '0',
    admin_fee: expense.admin_fee ?? '0',
    service_fee: expense.service_fee ?? '0',
    category_id: expense.category_id ?? '',
    subcategory_id: expense.subcategory_id ?? '',
    vendor_id: expense.vendor_id ?? '',
    business_unit: (expense.business_unit as ExpenseFormValues['business_unit']) ?? '',
    department: (expense.department as ExpenseFormValues['department']) ?? '',
    payment_method: expense.payment_method ?? '',
    due_date: expense.due_date ?? '',
  }

  return (
    <ExpenseForm
      projects={projects ?? []}
      employees={employees ?? []}
      mode="edit"
      expenseId={params.id}
      initialValues={initialValues}
      existingDocumentUrl={expense.document_url}
    />
  )
}
