'use server'

import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import type { ActionResult } from '@/lib/actions/expense.actions'

export interface CreateReimbursementBatchResult {
  batch_id: string
  batch_no: string
  processed_count: number
  total_amount: string | number
}

export async function createReimbursementBatch(
  expenseIds: string[],
  batchDate: string,
  paymentMethod: string,
  referenceNo: string | null,
  notes: string | null
): Promise<ActionResult<CreateReimbursementBatchResult>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const emp = await fetchMySessionEmployee(supabase)

  if (!emp?.role || !['owner', 'finance'].includes(emp.role)) {
    return { success: false, error: 'Hanya owner atau finance yang dapat memproses batch.' }
  }

  if (!expenseIds.length) {
    return { success: false, error: 'Pilih minimal satu expense.' }
  }

  const { data, error } = await supabase.rpc('create_reimbursement_batch', {
    p_expense_ids: expenseIds,
    p_batch_date: batchDate,
    p_payment_method: paymentMethod,
    p_reference_no: referenceNo,
    p_notes: notes,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const row = data as {
    success?: boolean
    message?: string
    batch_id?: string
    batch_no?: string
    processed_count?: number
    total_amount?: string | number
  }

  if (row.success === false) {
    return { success: false, error: row.message ?? 'Gagal membuat batch' }
  }

  if (!row.batch_id || !row.batch_no) {
    return { success: false, error: 'Respons server tidak valid' }
  }

  return {
    success: true,
    data: {
      batch_id: row.batch_id,
      batch_no: row.batch_no,
      processed_count: row.processed_count ?? expenseIds.length,
      total_amount: row.total_amount ?? '0',
    },
  }
}
