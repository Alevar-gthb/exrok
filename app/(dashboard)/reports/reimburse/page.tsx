// app/(dashboard)/reports/reimburse/page.tsx
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { redirect } from 'next/navigation'
import {
  ReimburseReportClient,
  type ReimburseReportExpenseRow,
  type ReimburseReportBatchRow,
} from '@/components/reimburse-report-client'

export const metadata = { title: 'Laporan Reimburse | Exrok' }

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 90)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}

export default async function ReimburseReportPage({
  searchParams,
}: {
  searchParams: {
    from?: string
    to?: string
    bu?: string
    type?: string
    employee?: string
    view?: string
  }
}) {
  const sp = searchParams
  const defaults = defaultDateRange()
  const from = sp.from ?? defaults.from
  const to = sp.to ?? defaults.to
  const bu = sp.bu?.trim() || ''
  const type = sp.type?.trim() || ''
  const employeeId = sp.employee?.trim() || ''
  const view = sp.view === 'paid' ? 'paid' : 'payable'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)

  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  let expQuery = supabase
    .from('expenses')
    .select(`
      id, ref_no, transaction_date, type, description,
      total_payment, status, business_unit, employee_id,
      reimbursement_batch_id, payment_date,
      employee:employees(id, full_name)
    `)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .in('status', ['Approved', 'Paid'])
    .order('transaction_date', { ascending: false })
    .limit(500)

  if (bu === 'RKT' || bu === 'SPH') expQuery = expQuery.eq('business_unit', bu)
  if (type === 'PO' || type === 'Reimburse' || type === 'Salary') expQuery = expQuery.eq('type', type)
  if (employeeId) expQuery = expQuery.eq('employee_id', employeeId)

  const [{ data: expenses }, { data: employees }, { data: batches }] = await Promise.all([
    expQuery,
    supabase.from('employees').select('id, full_name').order('full_name'),
    supabase
      .from('reimbursement_batches')
      .select('id, batch_no, batch_date, payment_method, reference_no, notes, total_amount, created_at')
      .gte('batch_date', from)
      .lte('batch_date', to)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const batchIds = (batches ?? []).map(b => b.id)
  let itemCountByBatch: Record<string, number> = {}
  if (batchIds.length) {
    const { data: itemRows } = await supabase
      .from('reimbursement_batch_items')
      .select('batch_id')
      .in('batch_id', batchIds)

    for (const r of itemRows ?? []) {
      const k = r.batch_id as string
      itemCountByBatch[k] = (itemCountByBatch[k] ?? 0) + 1
    }
  }

  const batchesWithCounts = (batches ?? []).map(b => ({
    ...b,
    item_count: itemCountByBatch[b.id] ?? 0,
  }))

  const expenseRows: ReimburseReportExpenseRow[] = (expenses ?? []).map(raw => {
    const e = raw as Record<string, unknown>
    const emp = e.employee
    const employee =
      emp == null
        ? null
        : Array.isArray(emp)
          ? (emp[0] as { id: string; full_name: string } | undefined) ?? null
          : (emp as { id: string; full_name: string })

    return {
      id: e.id as string,
      ref_no: e.ref_no as string | null,
      transaction_date: e.transaction_date as string,
      type: e.type as string,
      description: e.description as string | null,
      total_payment: String(e.total_payment ?? '0'),
      status: e.status as string,
      business_unit: e.business_unit as string | null,
      employee_id: e.employee_id as string | null,
      reimbursement_batch_id: e.reimbursement_batch_id as string | null,
      payment_date: e.payment_date as string | null,
      employee,
    }
  })

  return (
    <ReimburseReportClient
      expenses={expenseRows}
      employees={employees ?? []}
      batches={batchesWithCounts as ReimburseReportBatchRow[]}
      initialFilters={{ from, to, bu, type, employeeId, view }}
    />
  )
}
