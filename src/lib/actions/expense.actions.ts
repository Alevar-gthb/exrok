// ============================================================
// src/lib/actions/expense.actions.ts
// Server Action: insertExpense + helper kompresi file (client-side)
// ============================================================
'use server'

import { createClient } from '@/supabase/server'
import type { ExpenseInsert } from '@/types/database.types'

// ─── Type untuk hasil action ─────────────────────────────────

export interface ActionResult<T = null> {
  success: boolean
  data?: T
  error?: string
}

// ─── Fungsi utama: insertExpense ──────────────────────────────

/**
 * Menyimpan expense baru ke Supabase.
 * Dipanggil setelah form divalidasi di client.
 * `document_url` sudah berupa URL hasil upload dari client.
 */
export async function insertExpense(
  payload: Omit<ExpenseInsert, 'created_by'>
): Promise<ActionResult<{ id: string; ref_no: string | null }>> {
  const supabase = await createClient()

  // Ambil user yang sedang login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Sesi tidak valid. Silakan login kembali.' }
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...payload,
      // Pastikan nilai kosong dikonversi ke '0' bukan null
      vat: payload.vat ?? '0',
      admin_fee: payload.admin_fee ?? '0',
      service_fee: payload.service_fee ?? '0',
      status: 'Pending Approval',
      created_by: user.id,
    })
    .select('id, ref_no')
    .single()

  if (error) {
    console.error('[insertExpense]', error)
    return {
      success: false,
      error: error.message ?? 'Gagal menyimpan data. Coba lagi.',
    }
  }

  return { success: true, data }
}

// ─── Upload dokumen ke Supabase Storage ──────────────────────

/**
 * Upload file (sudah dikompresi) ke Supabase Storage.
 * Mengembalikan public URL file.
 * Fungsi ini dipanggil dari CLIENT sebelum insertExpense.
 */
export async function uploadExpenseDocument(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'File tidak ditemukan' }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('expense-documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('expense-documents').getPublicUrl(fileName)

  return { success: true, data: { url: publicUrl } }
}

// ─── updateExpenseStatus ──────────────────────────────────────

export async function updateExpenseStatus(
  id: string,
  status: 'Approved' | 'Rejected' | 'Draft' | 'Pending Approval'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  // Hanya owner/finance boleh approve/reject
  if (['Approved', 'Rejected'].includes(status)) {
    const { data: emp } = await supabase
      .from('employees')
      .select('role')
      .eq('email', user.email ?? '')
      .single()

    if (!emp || !['owner', 'finance'].includes(emp.role)) {
      return { success: false, error: 'Tidak memiliki akses untuk aksi ini.' }
    }
  }

  const { error } = await supabase
    .from('expenses')
    .update({ status })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
