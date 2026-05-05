'use server'

import { createClient } from '@/supabase/server'
import type { ActionResult } from '@/lib/actions/expense.actions'

export async function rpcSubmitExpense(expenseId: string): Promise<ActionResult<{ status?: string; message?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: expenseRow, error: expenseErr } = await supabase
    .from('expenses')
    .select('id, updated_at')
    .eq('id', expenseId)
    .single()
  if (expenseErr || !expenseRow) return { success: false, error: 'Expense tidak ditemukan' }

  const { data, error } = await supabase.rpc('submit_expense', {
    p_expense_id: expenseId,
    p_expected_updated_at: expenseRow.updated_at,
  })
  if (error) return { success: false, error: error.message }
  const row = data as { success?: boolean; message?: string; status?: string }
  if (row.success === false) return { success: false, error: row.message ?? 'Gagal submit' }
  return { success: true, data: { status: row.status, message: row.message } }
}

export async function rpcProcessApproval(
  approvalId: string,
  action: 'approve' | 'reject',
  notes: string | null
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: approvalRow, error: approvalErr } = await supabase
    .from('expense_approvals')
    .select('id, updated_at')
    .eq('id', approvalId)
    .single()
  if (approvalErr || !approvalRow) return { success: false, error: 'Approval tidak ditemukan' }

  const { data, error } = await supabase.rpc('process_approval', {
    p_expense_approval_id: approvalId,
    p_action: action,
    p_notes: notes,
    p_expected_updated_at: approvalRow.updated_at,
  })
  if (error) return { success: false, error: error.message }
  const row = data as { success?: boolean; message?: string }
  if (row.success === false) return { success: false, error: row.message ?? 'Gagal proses' }
  return { success: true }
}

export async function rpcBulkProcessApproval(
  approvalIds: string[],
  action: 'approve' | 'reject',
  notes: string | null
): Promise<ActionResult<{ processed?: number; failed?: number; message?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase.rpc('bulk_process_approval', {
    p_expense_approval_ids: approvalIds,
    p_action: action,
    p_notes: notes,
  })
  if (error) return { success: false, error: error.message }
  const row = data as { processed?: number; failed?: number; message?: string }
  return { success: true, data: row }
}
