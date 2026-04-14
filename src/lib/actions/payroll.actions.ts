'use server'

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/supabase/server'
import type { ActionResult } from '@/lib/actions/expense.actions'
import { insertExpense } from '@/lib/actions/expense.actions'
import { netFromAdjustments, parsePayrollAdjustments } from '@/lib/payroll-helpers'
import { insertPayrollRunForPeriod } from '@/lib/payroll-run-insert'
import type { PayrollLineAdjustment } from '@/types/database.types'

async function assertPayrollRole(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ ok: false; error: string } | { ok: true; user: User }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const { data: emp } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!emp || !['owner', 'finance'].includes(emp.role)) {
    return { ok: false, error: 'Hanya owner atau finance yang dapat mengelola payroll.' }
  }
  return { ok: true, user }
}

export async function createPayrollRun(periodYear: number, periodMonth: number): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const gate = await assertPayrollRole(supabase)
  if (!gate.ok) return { success: false, error: gate.error }

  const ins = await insertPayrollRunForPeriod(supabase, periodYear, periodMonth, gate.user.id)
  if (!ins.ok) return { success: false, error: ins.error }
  return { success: true, data: { id: ins.id } }
}

export async function updatePayrollRunLine(
  lineId: string,
  patch: {
    amount?: string
    project_id?: string | null
    adjustments?: PayrollLineAdjustment[]
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const gate = await assertPayrollRole(supabase)
  if (!gate.ok) return { success: false, error: gate.error }

  const { data: line } = await supabase.from('payroll_run_lines').select('id, run_id').eq('id', lineId).single()
  if (!line) return { success: false, error: 'Baris tidak ditemukan.' }

  const { data: run } = await supabase.from('payroll_runs').select('status').eq('id', line.run_id).single()
  if (!run || run.status !== 'draft') {
    return { success: false, error: 'Payroll sudah disubmit atau tidak ditemukan.' }
  }

  const { error } = await supabase
    .from('payroll_run_lines')
    .update({
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.project_id !== undefined ? { project_id: patch.project_id } : {}),
      ...(patch.adjustments !== undefined ? { adjustments: patch.adjustments } : {}),
    })
    .eq('id', lineId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function recalcPayrollLineAmountFromAdjustments(lineId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const gate = await assertPayrollRole(supabase)
  if (!gate.ok) return { success: false, error: gate.error }

  const { data: row } = await supabase.from('payroll_run_lines').select('base_amount, adjustments').eq('id', lineId).single()
  if (!row) return { success: false, error: 'Baris tidak ditemukan' }
  const base = Number(row.base_amount ?? 0)
  const adj = netFromAdjustments(parsePayrollAdjustments(row.adjustments))
  const total = (Number.isFinite(base) ? base : 0) + adj
  return updatePayrollRunLine(lineId, { amount: total.toFixed(2) })
}

export async function submitPayrollRun(runId: string): Promise<ActionResult<{ expenseCount: number }>> {
  const supabase = await createClient()
  const gate = await assertPayrollRole(supabase)
  if (!gate.ok) return { success: false, error: gate.error }

  const { data: run } = await supabase.from('payroll_runs').select('id, status, period_year, period_month').eq('id', runId).single()
  if (!run || run.status !== 'draft') {
    return { success: false, error: 'Payroll tidak ditemukan atau sudah disubmit.' }
  }

  const { data: lines, error: le } = await supabase
    .from('payroll_run_lines')
    .select('id, employee_id, project_id, amount, expense_id')
    .eq('run_id', runId)

  if (le || !lines?.length) return { success: false, error: le?.message ?? 'Tidak ada baris payroll.' }

  const pending = lines.filter(l => !l.expense_id)
  if (pending.length === 0) {
    const { error: u2 } = await supabase.from('payroll_runs').update({ status: 'submitted' }).eq('id', runId)
    if (u2) return { success: false, error: u2.message }
    return { success: true, data: { expenseCount: 0 } }
  }

  const { data: empNames } = await supabase.from('employees').select('id, full_name').in('id', pending.map(p => p.employee_id))
  const nameById = new Map((empNames ?? []).map(e => [e.id, e.full_name]))

  const y = run.period_year
  const m = run.period_month
  const transactionDate = `${y}-${String(m).padStart(2, '0')}-25`
  const label = `${String(m).padStart(2, '0')}/${y}`

  let count = 0
  for (const line of pending) {
    const name = nameById.get(line.employee_id) ?? 'Karyawan'
    const desc = `Gaji ${name} - ${label}`
    const ins = await insertExpense({
      ref_no: null,
      transaction_date: transactionDate,
      type: 'Salary',
      description: desc,
      amount: String(line.amount),
      vat: '0',
      admin_fee: '0',
      service_fee: '0',
      project_id: line.project_id ?? null,
      employee_id: line.employee_id,
      category_id: null,
      subcategory_id: null,
      vendor_id: null,
      business_unit: null,
      department: null,
      payment_method: null,
      due_date: null,
      payment_date: null,
      document_url: null,
      is_reconciled: false,
      reimbursement_batch_id: null,
    })
    if (!ins.success || !ins.data) {
      return { success: false, error: ins.error ?? 'Gagal insert expense' }
    }
    const { error: u1 } = await supabase.from('payroll_run_lines').update({ expense_id: ins.data.id }).eq('id', line.id)
    if (u1) return { success: false, error: u1.message }
    count += 1
  }

  const { error: u2 } = await supabase.from('payroll_runs').update({ status: 'submitted' }).eq('id', runId)
  if (u2) return { success: false, error: u2.message }

  return { success: true, data: { expenseCount: count } }
}

export async function deletePayrollRunDraft(runId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const gate = await assertPayrollRole(supabase)
  if (!gate.ok) return { success: false, error: gate.error }

  const { data: me } = await supabase.from('employees').select('role').eq('email', gate.user.email ?? '').single()
  if (me?.role !== 'owner') return { success: false, error: 'Hanya owner yang dapat menghapus draft payroll.' }

  const { data: run } = await supabase.from('payroll_runs').select('status').eq('id', runId).single()
  if (!run || run.status !== 'draft') return { success: false, error: 'Hanya draft yang dapat dihapus.' }

  const { error } = await supabase.from('payroll_runs').delete().eq('id', runId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
