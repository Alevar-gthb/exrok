'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatIDR } from '@/lib/decimal'
import { EXPENSE_STATUS_STYLE } from '@/lib/expense-status-styles'
import { rpcProcessApproval, rpcSubmitExpense } from '@/lib/actions/approval.actions'
import { markExpensePaid, uploadExpensePaymentProof } from '@/lib/actions/expense.actions'
import { SortableTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import {
  compareNum,
  compareText,
  cycleColumnSort,
  parseDecimalString,
} from '@/lib/table-sort'

type ApprovalRow = {
  id: string
  approver_employee_id: string | null
  status: string
  notes: string | null
  approved_at: string | null
  created_at: string
  approval_rule: { id: string; name: string } | null
  approver: { id: string; full_name: string; email: string | null } | null
}

type ExpenseDetail = {
  id: string
  ref_no: string | null
  submission_date: string
  transaction_date: string
  type: string
  description: string | null
  amount: string
  vat: string
  admin_fee: string
  service_fee: string
  total_payment: string
  status: string
  business_unit: string | null
  department: string | null
  payment_method: string | null
  due_date: string | null
  payment_date: string | null
  document_url: string | null
  payment_proof_url: string | null
  created_by: string | null
  project: { id: string; name: string; client_name: string | null } | null
  employee: { id: string; full_name: string; email: string | null } | null
  vendor: { id: string; name: string } | null
  category: { id: string; name: string } | null
  subcategory: { id: string; name: string } | null
}

interface ExpenseDetailClientProps {
  expense: ExpenseDetail
  approvals: ApprovalRow[]
  userId: string
  userRole: string
  myEmployeeId: string | null
}

function StatusBadge({ status }: { status: string }) {
  const s = EXPENSE_STATUS_STYLE[status] ?? EXPENSE_STATUS_STYLE.Draft
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '500',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

const ACCEPT_PAYMENT_PROOF = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf'
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function ExpenseDetailClient({
  expense: e,
  approvals,
  userId,
  userRole,
  myEmployeeId,
}: ExpenseDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [expense, setExpense] = useState<ExpenseDetail>(e)
  const [approvalRows, setApprovalRows] = useState<ApprovalRow[]>(approvals)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [markPaidDate, setMarkPaidDate] = useState(() => new Date().toISOString().split('T')[0])
  const [markPaidFile, setMarkPaidFile] = useState<File | null>(null)
  const [markPaidFileName, setMarkPaidFileName] = useState<string | null>(null)
  const [markPaidModalError, setMarkPaidModalError] = useState<string | null>(null)
  const [breakdownSort, setBreakdownSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })

  const breakdownLines = useMemo(
    () => [
      { key: 'amount', label: 'Amount', value: expense.amount },
      { key: 'vat', label: 'VAT', value: expense.vat },
      { key: 'admin_fee', label: 'Admin Fee', value: expense.admin_fee },
      { key: 'service_fee', label: 'Service Fee', value: expense.service_fee },
    ],
    [expense.amount, expense.vat, expense.admin_fee, expense.service_fee],
  )

  const sortedBreakdownLines = useMemo(() => {
    const k = breakdownSort.key
    if (!k) return breakdownLines
    const dir = breakdownSort.dir
    const copy = [...breakdownLines]
    if (k === 'label') copy.sort((a, b) => compareText(a.label, b.label, dir))
    else if (k === 'value')
      copy.sort((a, b) =>
        compareNum(parseDecimalString(a.value), parseDecimalString(b.value), dir),
      )
    return copy
  }, [breakdownLines, breakdownSort])

  const toggleBreakdownSort = useCallback((key: string) => {
    setBreakdownSort(s => cycleColumnSort(s, key))
  }, [])

  const isCreator = expense.created_by === userId
  const canFinance = ['owner', 'finance'].includes(userRole)

  const pendingRows = approvalRows.filter(a => a.status === 'Pending')
  const activeApproval =
    userRole === 'owner'
      ? pendingRows[0]
      : pendingRows.find(a => myEmployeeId && a.approver_employee_id === myEmployeeId)

  const lastRejected = [...approvalRows].reverse().find(a => a.status === 'Rejected')

  async function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleSubmit() {
    setError(null)
    const r = await rpcSubmitExpense(expense.id)
    if (!r.success) setError(r.error ?? 'Gagal')
    else setExpense(prev => ({ ...prev, status: 'Pending Approval' }))
  }

  async function handleApprove() {
    if (!activeApproval) return
    setError(null)
    const r = await rpcProcessApproval(activeApproval.id, 'approve', null)
    if (!r.success) setError(r.error ?? 'Gagal')
    else await refresh()
  }

  async function handleRejectConfirm() {
    if (!activeApproval) return
    setError(null)
    const r = await rpcProcessApproval(activeApproval.id, 'reject', rejectReason || null)
    setRejectOpen(false)
    setRejectReason('')
    if (!r.success) setError(r.error ?? 'Gagal')
    else await refresh()
  }

  function openMarkPaidModal() {
    setMarkPaidModalError(null)
    setMarkPaidDate(new Date().toISOString().split('T')[0])
    setMarkPaidFile(null)
    setMarkPaidFileName(null)
    setMarkPaidOpen(true)
  }

  async function handleMarkPaidConfirm() {
    setMarkPaidModalError(null)
    if (!markPaidDate) {
      setMarkPaidModalError('Tanggal bayar wajib diisi')
      return
    }
    if (!markPaidFile) {
      setMarkPaidModalError('Unggah bukti pembayaran (PDF, JPG, atau PNG, maks. 2MB)')
      return
    }

    let compressed: File
    try {
      const { compressFile } = await import('@/lib/compress-file')
      const r = await compressFile(markPaidFile)
      compressed = r.file
    } catch (err) {
      setMarkPaidModalError(err instanceof Error ? err.message : 'Gagal memproses file')
      return
    }

    const fd = new FormData()
    fd.set('file', compressed)
    const up = await uploadExpensePaymentProof(fd)
    if (!up.success || !up.data?.url) {
      setMarkPaidModalError(up.error ?? 'Gagal mengunggah bukti')
      return
    }

    const mk = await markExpensePaid({
      expenseId: expense.id,
      paymentDate: markPaidDate,
      paymentProofUrl: up.data.url,
    })
    if (!mk.success) {
      setMarkPaidModalError(mk.error ?? 'Gagal menandai dibayar')
      return
    }

    setMarkPaidOpen(false)
    setMarkPaidFile(null)
    setMarkPaidFileName(null)
    setExpense(prev => ({
      ...prev,
      status: 'Paid',
      payment_date: markPaidDate,
      payment_proof_url: up.data?.url ?? prev.payment_proof_url,
    }))
  }

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  }
  const label: React.CSSProperties = { fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }
  const val: React.CSSProperties = { fontSize: '13px', color: '#0F172A' }

  const docLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#2563EB',
  }

  return (
    <div className="expense-detail-grid">
      <div>
        <div style={{ ...card, marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: expense.ref_no || expense.description ? '10px' : 0 }}>
            <StatusBadge status={expense.status} />
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: '#F1F5F9',
                color: '#334155',
                fontWeight: 500,
              }}
            >
              {expense.type}
            </span>
          </div>
          {expense.ref_no && (
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: expense.description ? '8px' : 0 }}>Ref. {expense.ref_no}</div>
          )}
          {expense.description && (
            <p style={{ margin: 0, fontSize: '14px', color: '#0F172A', lineHeight: 1.45 }}>{expense.description}</p>
          )}
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 14px' }}>Informasi umum</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <div style={label}>Business Unit</div>
              <div style={val}>{expense.business_unit ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Department</div>
              <div style={val}>{expense.department ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Proyek</div>
              <div style={val}>{expense.project ? `${expense.project.name}${expense.project.client_name ? ` · ${expense.project.client_name}` : ''}` : '—'}</div>
            </div>
            <div>
              <div style={label}>Karyawan</div>
              <div style={val}>{expense.employee?.full_name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Vendor</div>
              <div style={val}>{expense.vendor?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Kategori</div>
              <div style={val}>{expense.category?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Subkategori</div>
              <div style={val}>{expense.subcategory?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Metode pembayaran</div>
              <div style={val}>{expense.payment_method ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Tanggal pengajuan</div>
              <div style={val}>{new Date(expense.submission_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div>
              <div style={label}>Tanggal transaksi</div>
              <div style={val}>{new Date(expense.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div>
              <div style={label}>Due date</div>
              <div style={val}>{expense.due_date ? new Date(expense.due_date).toLocaleDateString('id-ID') : '—'}</div>
            </div>
            <div>
              <div style={label}>Tanggal bayar</div>
              <div style={val}>{expense.payment_date ? new Date(expense.payment_date).toLocaleDateString('id-ID') : '—'}</div>
            </div>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 0 }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 12px' }}>Breakdown biaya</h2>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <SortableTh
                  label="Komponen"
                  columnKey="label"
                  activeKey={breakdownSort.key}
                  direction={breakdownSort.dir}
                  onToggle={toggleBreakdownSort}
                  kind="text"
                />
                <SortableTh
                  label="Nilai"
                  columnKey="value"
                  activeKey={breakdownSort.key}
                  direction={breakdownSort.dir}
                  onToggle={toggleBreakdownSort}
                  kind="number"
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sortedBreakdownLines.map(row => (
                <tr key={row.key}>
                  <td style={{ padding: '6px 0', color: '#64748B' }}>{row.label}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatIDR(row.value)}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '12px 0 0', fontWeight: '600', fontSize: '14px' }}>Total Payment</td>
                <td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: '700', fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatIDR(expense.total_payment)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ position: 'sticky', top: '80px' }}>
        <div style={{ ...card, padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Status &amp; aksi
          </h3>
          {error && (
            <div style={{ padding: '10px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', fontSize: '12px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          {expense.status === 'Draft' && isCreator && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(handleSubmit)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#0F172A',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: isPending ? 'wait' : 'pointer',
              }}
            >
              {isPending ? 'Memproses…' : 'Submit untuk Approval'}
            </button>
          )}

          {expense.status === 'Pending Approval' && !activeApproval && (
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px' }}>
              Menunggu persetujuan approver yang ditunjuk.
            </p>
          )}

          {expense.status === 'Pending Approval' && activeApproval && (
            <>
              <p style={{ fontSize: '13px', color: '#92400E', margin: '0 0 12px' }}>Menunggu persetujuan kamu</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(handleApprove)}
                  style={{
                    padding: '10px 14px',
                    background: '#F0FDF4',
                    color: '#166534',
                    border: '1px solid #86EFAC',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: isPending ? 'wait' : 'pointer',
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  style={{
                    padding: '10px 14px',
                    background: '#FEF2F2',
                    color: '#991B1B',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Tolak
                </button>
              </div>
            </>
          )}

          {expense.status === 'Approved' && canFinance && expense.payment_method !== 'Petty Cash' && (
            <button
              type="button"
              disabled={isPending}
              onClick={openMarkPaidModal}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#ECFEFF',
                color: '#0E7490',
                border: '1px solid #67E8F9',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: isPending ? 'wait' : 'pointer',
              }}
            >
              Tandai Sudah Dibayar
            </button>
          )}

          {expense.status === 'Rejected' && (
            <>
              {lastRejected?.notes && (
                <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 12px' }}>
                  Alasan: {lastRejected.notes}
                </p>
              )}
              {isCreator && (
                <Link
                  href={`/expenses/${expense.id}/edit`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '10px 14px',
                    background: '#fff',
                    color: '#0F172A',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    textDecoration: 'none',
                  }}
                >
                  Edit &amp; Resubmit
                </Link>
              )}
            </>
          )}

          {expense.status === 'Paid' && (
            <p style={{ fontSize: '13px', color: '#0E7490', margin: 0 }}>
              Pembayaran tercatat{expense.payment_date ? ` · ${new Date(expense.payment_date).toLocaleDateString('id-ID')}` : ''}
            </p>
          )}
        </div>

        <div style={{ ...card, padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Dokumen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ ...label, marginBottom: '6px' }}>Dokumen pendukung</div>
              {expense.document_url ? (
                <a href={expense.document_url} target="_blank" rel="noopener noreferrer" style={docLinkStyle}>
                  📎 Buka / unduh
                </a>
              ) : (
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Tidak ada</span>
              )}
            </div>
            <div>
              <div style={{ ...label, marginBottom: '6px' }}>Bukti pembayaran</div>
              {expense.payment_proof_url ? (
                <a href={expense.payment_proof_url} target="_blank" rel="noopener noreferrer" style={docLinkStyle}>
                  📎 Buka / unduh bukti bayar
                </a>
              ) : expense.payment_method === 'Petty Cash' && expense.document_url ? (
                <a href={expense.document_url} target="_blank" rel="noopener noreferrer" style={docLinkStyle}>
                  📎 Receipt awal (Petty Cash)
                </a>
              ) : (
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>{expense.status === 'Paid' ? '—' : 'Akan tersedia setelah dibayar'}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...card, padding: '18px', marginBottom: 0 }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Riwayat approval
          </h3>
          {approvalRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>Belum ada riwayat</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {approvalRows.map(a => (
                <li
                  key={a.id}
                  style={{
                    borderLeft: '2px solid #E2E8F0',
                    paddingLeft: '14px',
                    paddingBottom: '16px',
                    marginLeft: '6px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    {a.approval_rule?.name ?? 'Rule'}
                    {' · '}
                    <span style={{ color: '#64748B', fontWeight: '500' }}>{a.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {a.approver?.full_name ?? '—'}
                    {a.approved_at
                      ? ` · ${new Date(a.approved_at).toLocaleString('id-ID')}`
                      : ` · diajukan ${new Date(a.created_at).toLocaleString('id-ID')}`}
                  </div>
                  {a.notes && <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>{a.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {markPaidOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', maxWidth: '420px', width: '100%' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '15px' }}>Tandai sudah dibayar</h4>
            {markPaidModalError && (
              <div style={{ padding: '10px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', fontSize: '12px', marginBottom: '12px' }}>
                {markPaidModalError}
              </div>
            )}
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
              Tanggal bayar <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="date"
              value={markPaidDate}
              onChange={ev => setMarkPaidDate(ev.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                marginBottom: '14px',
                fontFamily: 'inherit',
              }}
            />
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
              Bukti pembayaran (PDF, JPG, PNG · maks. 2MB) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="file"
              accept={ACCEPT_PAYMENT_PROOF}
              style={{ fontSize: '13px', marginBottom: '8px', width: '100%' }}
              onChange={ev => {
                const f = ev.target.files?.[0] ?? null
                setMarkPaidFile(f)
                setMarkPaidFileName(f?.name ?? null)
                setMarkPaidModalError(null)
              }}
            />
            {markPaidFileName && (
              <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px' }}>
                {markPaidFileName}
                {markPaidFile && ` · ${formatBytes(markPaidFile.size)}`}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setMarkPaidOpen(false)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(handleMarkPaidConfirm)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0E7490',
                  color: '#fff',
                  cursor: isPending ? 'wait' : 'pointer',
                }}
              >
                {isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Tolak expense</h4>
            <textarea
              value={rejectReason}
              onChange={ev => setRejectReason(ev.target.value)}
              placeholder="Alasan (opsional)"
              rows={3}
              style={{ width: '100%', padding: '10px', fontSize: '13px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRejectOpen(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}>
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(handleRejectConfirm)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#991B1B', color: '#fff', cursor: 'pointer' }}
              >
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
