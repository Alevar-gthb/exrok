'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  expenseSchema, expenseDefaultValues, PAYMENT_METHODS,
  type ExpenseFormValues,
} from '@/lib/validations/expense.schema'
import { createExpenseWithDocument, updateExpense, uploadExpenseDocument } from '@/lib/actions/expense.actions'
import { calculateTotalPayment, formatIDR } from '@/lib/decimal'
import { useOcrFill } from '@/lib/ocr/use-ocr-fill'
import type { Project, ExpenseFormEmployee } from '@/types/database.types'

interface ExpenseFormProps {
  projects: Project[]
  employees: ExpenseFormEmployee[]
  categories: Category[]
  subcategories: Subcategory[]
  vendors: Vendor[]
  /** Mode edit: isi expense yang sudah ada (Draft / Rejected) */
  mode?: 'create' | 'edit'
  expenseId?: string
  initialValues?: Partial<ExpenseFormValues>
  existingDocumentUrl?: string | null
}
type DocumentOcrPhase = 'idle' | 'scanning' | 'success' | 'error'

interface FilePreview {
  name: string; type: string; originalSize: number; compressedSize?: number
  wasCompressed?: boolean; previewUrl?: string; compressedFile?: File
  isCompressing: boolean; error?: string
}
interface Category { id: string; name: string }
interface Subcategory { id: string; category_id: string; name: string }
interface Vendor { id: string; name: string }

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Shared styles ────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: '13px',
  border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none',
  color: '#0F172A', background: '#fff', fontFamily: 'inherit',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }
const err: React.CSSProperties = { fontSize: '11px', color: '#DC2626', marginTop: '4px' }
const fo = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#94A3B8')
const fb = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#E2E8F0')

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={lbl}>{label}{required && <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>}</label>
      {children}
      {error && <p style={err}>{error}</p>}
    </div>
  )
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function CurrencyInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const fmt = (v: string) => v && v !== '0' ? Math.round(parseFloat(v)).toLocaleString('id-ID') : ''
  const [display, setDisplay] = useState(fmt(value))
  useEffect(() => { setDisplay(fmt(value)) }, [value])
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94A3B8', pointerEvents: 'none' }}>Rp</span>
      <input type="text" inputMode="numeric" value={display} disabled={disabled}
        onChange={e => { const r = e.target.value.replace(/[^0-9]/g, ''); setDisplay(r ? parseInt(r).toLocaleString('id-ID') : ''); onChange(r || '0') }}
        style={{ ...inp, paddingLeft: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : undefined }}
        onFocus={fo} onBlur={fb} />
    </div>
  )
}

function FileDropzone({
  preview,
  onFileSelect,
  onRemove,
  ocrPhase = 'idle',
  ocrErrorMsg,
  ocrLowFields,
}: {
  preview: FilePreview | null
  onFileSelect: (f: File) => void
  onRemove: () => void
  ocrPhase?: DocumentOcrPhase
  ocrErrorMsg?: string | null
  ocrLowFields?: string[] | null
}) {
  const [isDrag, setIsDrag] = useState(false)
  if (preview) {
    const showOcrRow = !preview.isCompressing && !preview.error
    return (
      <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', background: '#F8FAFC', position: 'relative' }}>
        <button type="button" onClick={onRemove} style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            {preview.type.startsWith('image/') && preview.previewUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📄'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: '500', color: '#334155', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</p>
            {preview.isCompressing && <p style={{ fontSize: '11px', color: '#D97706', margin: 0 }}>⏳ Mengompresi...</p>}
            {preview.error && <p style={{ fontSize: '11px', color: '#DC2626', margin: 0 }}>⚠ {preview.error}</p>}
            {!preview.isCompressing && !preview.error && (
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>
                {formatBytes(preview.originalSize)}
                {preview.wasCompressed && preview.compressedSize && <span style={{ color: '#059669', marginLeft: '6px' }}>→ {formatBytes(preview.compressedSize)} ✓</span>}
              </p>
            )}
            {showOcrRow && ocrPhase === 'scanning' && (
              <p style={{ fontSize: '11px', color: '#B45309', margin: '6px 0 0' }}>⏳ Membaca bon…</p>
            )}
            {showOcrRow && ocrPhase === 'success' && (
              <>
                <p style={{ fontSize: '11px', color: '#059669', margin: '6px 0 0' }}>✓ Form diisi dari bon. Periksa sebelum submit.</p>
                {ocrLowFields && ocrLowFields.length > 0 && (
                  <p style={{ fontSize: '11px', color: '#B45309', margin: '4px 0 0' }}>Periksa ulang: {ocrLowFields.join(', ')}</p>
                )}
              </>
            )}
            {showOcrRow && ocrPhase === 'error' && ocrErrorMsg && (
              <p style={{ fontSize: '11px', color: '#B45309', margin: '6px 0 0' }}>
                ⚠ {ocrErrorMsg} — file tetap digunakan; isi form manual jika perlu.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '28px', cursor: 'pointer', border: `2px dashed ${isDrag ? '#94A3B8' : '#E2E8F0'}`, borderRadius: '10px', background: isDrag ? '#F1F5F9' : '#F8FAFC', transition: 'all .15s', textAlign: 'center' }}
      onDragOver={e => { e.preventDefault(); setIsDrag(true) }} onDragLeave={() => setIsDrag(false)}
      onDrop={e => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f) }}>
      <span style={{ fontSize: '24px' }}>📎</span>
      <div>
        <p style={{ fontSize: '13px', fontWeight: '500', color: '#475569', margin: '0 0 2px' }}>Tarik file ke sini atau <span style={{ color: '#3B82F6', textDecoration: 'underline' }}>pilih file</span></p>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>JPG, PNG, PDF · Maks. 2MB</p>
      </div>
      <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = '' }} />
    </label>
  )
}

function TotalBreakdown({ amount, vat, adminFee, serviceFee }: { amount: string; vat: string; adminFee: string; serviceFee: string }) {
  const total = calculateTotalPayment(amount || '0', vat || '0', adminFee || '0', serviceFee || '0')
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', background: '#F8FAFC' }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid #E2E8F0', fontSize: '11px', fontWeight: '600', color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase' }}>Ringkasan Biaya</div>
      {[['DPP (Amount)', amount], ['VAT / PPN', vat], ['Admin Fee', adminFee], ['Service Fee', serviceFee]].map(([l, v], i) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '13px', color: i === 0 ? '#475569' : '#94A3B8' }}>{l}</span>
          <span style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: i === 0 ? '#334155' : '#94A3B8' }}>{formatIDR(v || '0')}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#fff' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>Total Pembayaran</span>
        <span style={{ fontSize: '17px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(total)}</span>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export function ExpenseForm({
  projects,
  employees,
  categories,
  subcategories,
  vendors,
  mode = 'create',
  expenseId,
  initialValues,
  existingDocumentUrl,
}: ExpenseFormProps) {
  const router = useRouter()
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const mergedDefaults = {
    ...expenseDefaultValues,
    ...initialValues,
    document_url: existingDocumentUrl ?? '',
  } as Partial<ExpenseFormValues>

  const { register, handleSubmit, control, setValue, formState: { errors }, reset, clearErrors, setError } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema), defaultValues: mergedDefaults as ExpenseFormValues, mode: 'onChange',
  })

  const uploadGenRef = useRef(0)
  const [ocrPhase, setOcrPhase] = useState<DocumentOcrPhase>('idle')
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string | null>(null)
  const [ocrLowFields, setOcrLowFields] = useState<string[] | null>(null)
  const { fillFromOcr } = useOcrFill(setValue)

  const [amount, vat, adminFee, serviceFee, categoryId, hasVat] = useWatch({
    control,
    name: ['amount', 'vat', 'admin_fee', 'service_fee', 'category_id', 'has_vat'],
  })
  const [amountInput, vatInput, adminFeeInput, serviceFeeInput] = useWatch({
    control,
    name: ['amount', 'vat', 'admin_fee', 'service_fee'],
  })

  // Filter subcat by selected category
  const filteredSubcats = categoryId ? subcategories.filter(s => s.category_id === categoryId) : subcategories

  // Reset subcategory when category changes
  useEffect(() => { setValue('subcategory_id', '') }, [categoryId, setValue])

  useEffect(() => {
    if (hasVat === false) setValue('vat', '0', { shouldValidate: true })
  }, [hasVat, setValue])

  const clearDocumentOcr = useCallback(() => {
    uploadGenRef.current += 1
    setOcrPhase('idle')
    setOcrErrorMsg(null)
    setOcrLowFields(null)
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    const myGen = ++uploadGenRef.current
    setOcrPhase('idle')
    setOcrErrorMsg(null)
    setOcrLowFields(null)

    setFilePreview({
      name: file.name,
      type: file.type,
      originalSize: file.size,
      isCompressing: file.type !== 'application/pdf',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    })
    clearErrors('document')

    try {
      const { compressFile } = await import('@/lib/compress-file')
      const result = await compressFile(file)
      if (myGen !== uploadGenRef.current) return

      setFilePreview(prev =>
        prev
          ? {
              ...prev,
              compressedSize: result.compressedSize,
              wasCompressed: result.wasCompressed,
              compressedFile: result.file,
              isCompressing: false,
            }
          : null,
      )

      setOcrPhase('scanning')
      try {
        const { postReceiptOcrFromFile } = await import('@/lib/ocr/receipt-ocr-client')
        const ocrResult = await postReceiptOcrFromFile(result.file)
        if (myGen !== uploadGenRef.current) return
        fillFromOcr(ocrResult)
        setOcrPhase('success')
        setOcrLowFields(ocrResult.low_confidence_fields ?? [])
        setOcrErrorMsg(null)
      } catch (ocrErr) {
        if (myGen !== uploadGenRef.current) return
        setOcrPhase('error')
        setOcrErrorMsg(ocrErr instanceof Error ? ocrErr.message : 'Gagal membaca bon')
        setOcrLowFields(null)
      }
    } catch (e) {
      if (myGen !== uploadGenRef.current) return
      const msg = e instanceof Error ? e.message : 'Gagal memproses file'
      setFilePreview(prev => (prev ? { ...prev, error: msg, isCompressing: false } : null))
      setError('document', { message: msg })
      setOcrPhase('idle')
    }
  }, [clearErrors, setError, fillFromOcr])

  const onSubmit = async (values: ExpenseFormValues) => {
    setIsSubmitting(true); setSubmitResult(null)
    try {
      const vatEffective = values.has_vat ? (values.vat || '0') : '0'
      const basePayload = {
        transaction_date: values.transaction_date, type: values.type, description: values.description,
        project_id: values.project_id || null, employee_id: values.employee_id || null,
        amount: values.amount, vat: vatEffective, admin_fee: values.admin_fee || '0', service_fee: values.service_fee || '0',
        category_id: values.category_id || null, subcategory_id: values.subcategory_id || null,
        vendor_id: values.vendor_id || null,
        business_unit: (values.business_unit as 'RKT' | 'SPH') || null,
        department: values.department || null, payment_method: values.payment_method || null,
        due_date: values.due_date || null,
        payment_date: null,
        is_reconciled: false,
        ocr_scanned: Boolean(values.ocr_scanned),
        ocr_confidence: values.ocr_confidence ?? null,
        ocr_scanned_at: values.ocr_scanned ? new Date().toISOString() : null,
      }
      if (mode === 'edit' && expenseId) {
        let documentUrl: string | undefined
        if (filePreview && !filePreview.error && !filePreview.isCompressing) {
          const fd = new FormData(); fd.append('file', filePreview.compressedFile ?? (values.document as File))
          const up = await uploadExpenseDocument(fd)
          if (!up.success) { setError('document', { message: up.error }); setIsSubmitting(false); return }
          documentUrl = up.data?.url
        }
        const payload = {
          ...basePayload,
          document_url: documentUrl ?? existingDocumentUrl ?? null,
        }
        const result = await updateExpense(expenseId, payload)
        if (result.success) {
          setSubmitResult({ type: 'success', message: 'Perubahan disimpan dan approval diproses.' })
          setTimeout(() => router.push(`/expenses/${expenseId}`), 900)
        } else { setSubmitResult({ type: 'error', message: result.error ?? 'Terjadi kesalahan' }) }
      } else {
        const submitData = new FormData()
        if (filePreview && !filePreview.error && !filePreview.isCompressing) {
          submitData.set('file', filePreview.compressedFile ?? (values.document as File))
        }
        submitData.set('payload', JSON.stringify({
          ...basePayload,
          document_url: existingDocumentUrl ?? null,
          ref_no: null,
          reimbursement_batch_id: null,
        }))
        const result = await createExpenseWithDocument(submitData)
        if (result.success && result.data) {
          const d = result.data
          const tail = [d.ref_no, d.message].filter(Boolean).join(' · ')
          setSubmitResult({
            type: 'success',
            message: tail ? `Expense tersimpan · ${tail}` : 'Expense tersimpan.',
          })
          reset(expenseDefaultValues)
          setFilePreview(null)
          uploadGenRef.current += 1
          setOcrPhase('idle')
          setOcrErrorMsg(null)
          setOcrLowFields(null)
          setTimeout(() => router.push(`/expenses/${d.id}`), 900)
        } else { setSubmitResult({ type: 'error', message: result.error ?? 'Terjadi kesalahan' }) }
      }
    } catch (e) {
      setSubmitResult({ type: 'error', message: e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga' })
    } finally { setIsSubmitting(false) }
  }

  // Mobile-responsive grid: 1 col on small, 2 col on wide
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '14px 20px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5"/><path d="M1 6h14M5 10h3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: '600', color: '#0F172A', margin: 0 }}>
              {mode === 'edit' ? 'Edit expense' : 'Pengajuan Pengeluaran'}
            </h1>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
              {mode === 'edit' ? 'Perbarui data; approval diproses otomatis setelah simpan' : 'Isi form — status langsung mengikuti approval rules'}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '20px 16px' }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Dokumen */}
          <Section title="Dokumen Pendukung">
            <FileDropzone
              preview={filePreview}
              onFileSelect={handleFileSelect}
              onRemove={() => {
                clearDocumentOcr()
                setFilePreview(null)
                clearErrors('document')
              }}
              ocrPhase={ocrPhase}
              ocrErrorMsg={ocrErrorMsg}
              ocrLowFields={ocrLowFields}
            />
            {errors.document && <p style={{ ...err, marginTop: '6px' }}>{errors.document.message as string}</p>}
          </Section>

          {/* Informasi Transaksi */}
          <Section title="Informasi Transaksi">
            <div style={grid}>
              <Field label="Tanggal transaksi" required error={errors.transaction_date?.message}>
                <input type="date" {...register('transaction_date')} style={inp} onFocus={fo} onBlur={fb} />
              </Field>
              <Field label="Tipe" required error={errors.type?.message}>
                <select {...register('type')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="PO">Purchase Order (PO)</option>
                  <option value="Reimburse">Reimburse</option>
                  <option value="Salary">Salary</option>
                </select>
              </Field>
              <Field label="Business Unit" error={errors.business_unit?.message}>
                <select {...register('business_unit')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih...</option>
                  <option value="RKT">RKT — Roketin</option>
                  <option value="SPH">SPH — Spacehub</option>
                </select>
              </Field>
              <Field label="Department" error={errors.department?.message}>
                <select {...register('department')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih...</option>
                  <option value="Technology">Technology</option>
                  <option value="Operation">Operation</option>
                  <option value="Sales">Sales</option>
                  <option value="Human Capital">Human Capital</option>
                </select>
              </Field>
              <Field label="Proyek" error={errors.project_id?.message}>
                <select {...register('project_id')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih proyek...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.client_name ? ` · ${p.client_name}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Karyawan" error={errors.employee_id?.message}>
                <select {...register('employee_id')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih karyawan...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {[e.nip, e.full_name].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: '16px' }}>
              <Field label="Deskripsi" required error={errors.description?.message}>
                <textarea {...register('description')} rows={3} placeholder="Jelaskan keperluan pengeluaran ini..."
                  style={{ ...inp, resize: 'none', lineHeight: '1.6' }} onFocus={fo} onBlur={fb} />
              </Field>
            </div>
          </Section>

          {/* Kategori & Vendor */}
          <Section title="Kategori & Vendor">
            <div style={grid}>
              <Field label="Kategori" error={errors.category_id?.message}>
                <select {...register('category_id')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih kategori...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Subkategori" error={errors.subcategory_id?.message}>
                <select {...register('subcategory_id')} style={inp} onFocus={fo} onBlur={fb} disabled={!categoryId}>
                  <option value="">Pilih subkategori...</option>
                  {filteredSubcats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Vendor" error={errors.vendor_id?.message}>
                <select {...register('vendor_id')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Metode Pembayaran" error={errors.payment_method?.message}>
                <select {...register('payment_method')} style={inp} onFocus={fo} onBlur={fb}>
                  <option value="">Pilih metode...</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Rincian Biaya */}
          <Section title="Rincian Biaya">
            <div style={grid}>
              <Field label="DPP (Amount)" required error={errors.amount?.message}>
                <CurrencyInput value={amountInput || ''} onChange={v => setValue('amount', v, { shouldValidate: true })} />
              </Field>
              <Field label="Kena PPN (VAT)" error={errors.has_vat?.message}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!hasVat}
                    onChange={e => setValue('has_vat', e.target.checked, { shouldDirty: true, shouldValidate: true })}
                    style={{ width: '16px', height: '16px', accentColor: '#1D4ED8' }}
                  />
                  <span>Ada PPN — isi nominal VAT di bawah</span>
                </label>
              </Field>
              <Field label="VAT / PPN" error={errors.vat?.message}>
                <CurrencyInput
                  value={vatInput || ''}
                  onChange={v => setValue('vat', v)}
                  disabled={!hasVat}
                />
              </Field>
              <Field label="Admin Fee" error={errors.admin_fee?.message}>
                <CurrencyInput value={adminFeeInput || ''} onChange={v => setValue('admin_fee', v)} />
              </Field>
              <Field label="Service Fee" error={errors.service_fee?.message}>
                <CurrencyInput value={serviceFeeInput || ''} onChange={v => setValue('service_fee', v)} />
              </Field>
              <Field label="Due Date" error={errors.due_date?.message}>
                <input type="date" {...register('due_date')} style={inp} onFocus={fo} onBlur={fb} />
              </Field>
            </div>
            <div style={{ marginTop: '16px' }}>
              <TotalBreakdown amount={amount || ''} vat={vat || ''} adminFee={adminFee || ''} serviceFee={serviceFee || ''} />
            </div>
          </Section>

          {/* Status */}
          {submitResult && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: submitResult.type === 'success' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${submitResult.type === 'success' ? '#86EFAC' : '#FECACA'}`, color: submitResult.type === 'success' ? '#166534' : '#B91C1C' }}>
              {submitResult.type === 'success' ? '✓' : '⚠'} {submitResult.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 20px', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '8px 16px', fontSize: '13px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>Batal</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => {
                reset(expenseDefaultValues)
                clearDocumentOcr()
                setFilePreview(null)
                setSubmitResult(null)
              }}
                style={{ padding: '8px 16px', fontSize: '13px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}>Reset</button>
              <button type="submit" disabled={isSubmitting || !!filePreview?.isCompressing || ocrPhase === 'scanning'}
                style={{ padding: '8px 24px', fontSize: '13px', fontWeight: '500', minWidth: '130px', background: isSubmitting ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? 'Menyimpan...' : mode === 'edit' ? 'Simpan perubahan' : 'Ajukan Expense'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
