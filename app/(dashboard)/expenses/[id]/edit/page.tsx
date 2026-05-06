import { createClient } from '@/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import type { ExpenseFormValues } from '@/lib/validations/expense.schema'
import type { Expense } from '@/types/database.types'
import { fetchMySessionEmployee } from '@/lib/employee-session'

export const metadata = { title: 'Edit Expense | Exrok' }

export default async function EditExpensePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await fetchMySessionEmployee(supabase)
  const canViewPettyCashBalance = Boolean(me?.role && ['owner', 'finance'].includes(me.role))

  const { data: expense, error } = await supabase.from('expenses').select('*').eq('id', params.id).single()

  if (error || !expense) notFound()

  if (expense.created_by !== user.id || !['Draft', 'Rejected'].includes(expense.status)) {
    redirect(`/expenses/${params.id}`)
  }

  const [{ data: projects }, { data: employees }, { data: categories }, { data: subcategories }, { data: vendors }, walletBalanceRpc] = await Promise.all([
    supabase.from('projects').select('id, name, client_name, status').eq('status', 'Active').order('name'),
    supabase.from('employees').select('id, full_name, email, nip, job_title, role, status, created_at').eq('status', 'Active').order('full_name'),
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

  const row = expense as Expense

  const initialValues: Partial<ExpenseFormValues> = {
    submission_date: expense.submission_date,
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
    has_vat: Number.parseFloat(String(expense.vat ?? '0')) > 0,
    ocr_scanned: row.ocr_scanned ?? false,
    ocr_confidence: row.ocr_confidence ?? null,
  }

  return (
    <ExpenseForm
      projects={projects ?? []}
      employees={employees ?? []}
      categories={categories ?? []}
      subcategories={subcategories ?? []}
      vendors={vendors ?? []}
      mode="edit"
      expenseId={params.id}
      initialValues={initialValues}
      existingDocumentUrl={expense.document_url}
      canViewPettyCashBalance={canViewPettyCashBalance}
      pettyCashMaxAmount={walletBalance}
    />
  )
}
