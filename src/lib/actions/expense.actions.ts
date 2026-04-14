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

const EXPENSE_FILE_MAX_BYTES = 2 * 1024 * 1024
const EXPENSE_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

function parseSubmitExpenseRpc(data: unknown): { ok: true; status: string; message: string } | { ok: false; error: string } {
  const row = data as { success?: boolean; message?: string; status?: string }
  if (row.success === false) return { ok: false, error: row.message ?? 'Gagal memproses approval' }
  return { ok: true, status: row.status ?? '', message: row.message ?? '' }
}

// ─── Fungsi utama: insertExpense ──────────────────────────────

/**
 * Menyimpan expense baru ke Supabase, lalu langsung jalankan approval rules
 * (status akhir: Approved atau Pending Approval).
 */
export async function insertExpense(
  payload: Omit<ExpenseInsert, 'created_by' | 'status'>
): Promise<ActionResult<{ id: string; ref_no: string | null; status: string; message?: string }>> {
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
      status: 'Draft',
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

  const { data: submitData, error: submitErr } = await supabase.rpc('submit_expense', { p_expense_id: data.id })
  if (submitErr) {
    await supabase.from('expenses').delete().eq('id', data.id)
    return { success: false, error: submitErr.message }
  }
  const parsed = parseSubmitExpenseRpc(submitData)
  if (!parsed.ok) {
    await supabase.from('expenses').delete().eq('id', data.id)
    return { success: false, error: parsed.error }
  }

  return {
    success: true,
    data: {
      id: data.id,
      ref_no: data.ref_no,
      status: parsed.status,
      message: parsed.message,
    },
  }
}

async function uploadExpenseFileToStorage(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  file: File
  folder?: string
}): Promise<ActionResult<{ url: string }>> {
  const { supabase, userId, file, folder } = params

  if (!EXPENSE_FILE_TYPES.includes(file.type as (typeof EXPENSE_FILE_TYPES)[number])) {
    return { success: false, error: 'Format file harus JPG, PNG, atau PDF' }
  }
  if (file.size > EXPENSE_FILE_MAX_BYTES) {
    return { success: false, error: `File terlalu besar (maks. 2MB, saat ini ${Math.round(file.size / 1024)} KB)` }
  }

  const ext = file.name.split('.').pop() || 'bin'
  const basePath = folder ? `${userId}/${folder}` : userId
  const fileName = `${basePath}/${Date.now()}.${ext}`

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

export async function createExpenseWithDocument(
  formData: FormData
): Promise<ActionResult<{ id: string; ref_no: string | null; status: string; message?: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Sesi tidak valid. Silakan login kembali.' }

  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') {
    return { success: false, error: 'Payload expense tidak valid' }
  }

  let payload: Omit<ExpenseInsert, 'created_by' | 'status'>
  try {
    payload = JSON.parse(payloadRaw) as Omit<ExpenseInsert, 'created_by' | 'status'>
  } catch {
    return { success: false, error: 'Payload expense gagal diproses' }
  }

  const file = formData.get('file') as File | null
  let documentUrl = payload.document_url ?? null

  if (file) {
    const uploadResult = await uploadExpenseFileToStorage({ supabase, userId: user.id, file })
    if (!uploadResult.success || !uploadResult.data?.url) {
      return { success: false, error: uploadResult.error ?? 'Gagal upload dokumen' }
    }
    documentUrl = uploadResult.data.url
  }

  return insertExpense({
    ...payload,
    document_url: documentUrl,
  })
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

  return uploadExpenseFileToStorage({ supabase, userId: user.id, file })
}

/** Upload bukti pembayaran (folder terpisah di bucket yang sama). */
export async function uploadExpensePaymentProof(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: emp } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email ?? '')
    .single()
  if (!emp || !['owner', 'finance'].includes(emp.role)) {
    return { success: false, error: 'Tidak memiliki akses untuk mengunggah bukti bayar.' }
  }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'File tidak ditemukan' }
  const uploaded = await uploadExpenseFileToStorage({
    supabase,
    userId: user.id,
    file,
    folder: 'payment-proof',
  })
  if (!uploaded.success) return uploaded
  return { success: true, data: { url: uploaded.data!.url } }
}

/** Finance/owner: tandai Paid dengan tanggal bayar dan URL bukti (wajib). */
export async function markExpensePaid(input: {
  expenseId: string
  paymentDate: string
  paymentProofUrl: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: emp } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email ?? '')
    .single()
  if (!emp || !['owner', 'finance'].includes(emp.role)) {
    return { success: false, error: 'Tidak memiliki akses untuk aksi ini.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
    return { success: false, error: 'Format tanggal bayar tidak valid' }
  }
  if (!input.paymentProofUrl?.trim()) {
    return { success: false, error: 'Bukti pembayaran wajib diunggah' }
  }

  const { data: row, error: fetchErr } = await supabase
    .from('expenses')
    .select('id, status, payment_method')
    .eq('id', input.expenseId)
    .single()
  if (fetchErr || !row) return { success: false, error: 'Expense tidak ditemukan' }
  if (row.payment_method === 'Petty Cash') {
    return { success: false, error: 'Expense Petty Cash otomatis dibayar saat submit' }
  }
  if (row.status !== 'Approved') {
    return { success: false, error: 'Hanya expense berstatus Disetujui yang bisa ditandai dibayar' }
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'Paid',
      payment_date: input.paymentDate,
      payment_proof_url: input.paymentProofUrl.trim(),
    })
    .eq('id', input.expenseId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── updateExpenseStatus ──────────────────────────────────────

export async function updateExpenseStatus(
  id: string,
  status: 'Approved' | 'Rejected' | 'Draft' | 'Pending Approval'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  // Hanya owner/finance boleh set status tertentu
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

  const patch: Record<string, unknown> = { status }

  const { error } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateExpense(
  id: string,
  payload: Partial<Omit<ExpenseInsert, 'created_by'>>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: row, error: fetchErr } = await supabase
    .from('expenses')
    .select('created_by, status')
    .eq('id', id)
    .single()

  if (fetchErr || !row) return { success: false, error: 'Expense tidak ditemukan' }
  if (row.created_by !== user.id) return { success: false, error: 'Akses ditolak' }
  if (!['Draft', 'Rejected'].includes(row.status)) {
    return { success: false, error: 'Hanya expense Draft atau Rejected yang bisa diedit' }
  }

  const patch = {
    ...payload,
    vat: payload.vat ?? '0',
    admin_fee: payload.admin_fee ?? '0',
    service_fee: payload.service_fee ?? '0',
    status: 'Draft' as const,
  }

  const { error } = await supabase.from('expenses').update(patch).eq('id', id)

  if (error) return { success: false, error: error.message }

  const { data: submitData, error: submitErr } = await supabase.rpc('submit_expense', { p_expense_id: id })
  if (submitErr) return { success: false, error: submitErr.message }
  const parsed = parseSubmitExpenseRpc(submitData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  return { success: true }
}
