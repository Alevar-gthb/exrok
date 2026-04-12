'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatIDR } from '@/lib/decimal'
import { EXPENSE_STATUS_STYLE } from '@/lib/expense-status-styles'
import { rpcProcessApproval, rpcSubmitExpense } from '@/lib/actions/approval.actions'
import { updateExpenseStatus } from '@/lib/actions/expense.actions'

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
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const isCreator = e.created_by === userId
  const canFinance = ['owner', 'finance'].includes(userRole)

  const pendingRows = approvals.filter(a => a.status === 'Pending')
  const activeApproval =
    userRole === 'owner'
      ? pendingRows[0]
      : pendingRows.find(a => myEmployeeId && a.approver_employee_id === myEmployeeId)

  const lastRejected = [...approvals].reverse().find(a => a.status === 'Rejected')

  async function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleSubmit() {
    setError(null)
    const r = await rpcSubmitExpense(e.id)
    if (!r.success) setError(r.error ?? 'Gagal')
    else await refresh()
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

  async function handleMarkPaid() {
    setError(null)
    const r = await updateExpenseStatus(e.id, 'Paid')
    if (!r.success) setError(r.error ?? 'Gagal')
    else await refresh()
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

  return (
    <div className="expense-detail-grid">

      <div>
        <div style={{ ...card, marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '12px', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', margin: '0 0 8px' }}>
                {e.ref_no ?? 'Tanpa ref'}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <StatusBadge status={e.status} />
                <span style={{ fontSize: '13px', color: '#64748B' }}>
                  {new Date(e.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#334155' }}>{e.type}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 14px' }}>Informasi umum</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={label}>Deskripsi</div>
              <div style={val}>{e.description ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Business Unit</div>
              <div style={val}>{e.business_unit ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Department</div>
              <div style={val}>{e.department ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Proyek</div>
              <div style={val}>{e.project ? `${e.project.name}${e.project.client_name ? ` · ${e.project.client_name}` : ''}` : '—'}</div>
            </div>
            <div>
              <div style={label}>Karyawan</div>
              <div style={val}>{e.employee?.full_name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Vendor</div>
              <div style={val}>{e.vendor?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Kategori</div>
              <div style={val}>{e.category?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Subkategori</div>
              <div style={val}>{e.subcategory?.name ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Metode pembayaran</div>
              <div style={val}>{e.payment_method ?? '—'}</div>
            </div>
            <div>
              <div style={label}>Due date</div>
              <div style={val}>{e.due_date ? new Date(e.due_date).toLocaleDateString('id-ID') : '—'}</div>
            </div>
            <div>
              <div style={label}>Tanggal bayar</div>
              <div style={val}>{e.payment_date ? new Date(e.payment_date).toLocaleDateString('id-ID') : '—'}</div>
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 12px' }}>Breakdown biaya</h2>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Amount', e.amount],
                ['VAT', e.vat],
                ['Admin Fee', e.admin_fee],
                ['Service Fee', e.service_fee],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td style={{ padding: '6px 0', color: '#64748B' }}>{k}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(v)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '12px 0 0', fontWeight: '600', fontSize: '14px' }}>Total Payment</td>
                <td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: '700', fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatIDR(e.total_payment)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 12px' }}>Dokumen</h2>
          {e.document_url ? (
            <a
              href={e.document_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#2563EB' }}
            >
              📎 Buka / unduh dokumen
            </a>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>Tidak ada dokumen</p>
          )}
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 16px' }}>Riwayat approval</h2>
          {approvals.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>Belum ada riwayat</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {approvals.map(a => (
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

      <div style={{ position: 'sticky', top: '80px' }}>
        <div style={{ ...card, padding: '18px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Status &amp; aksi
          </h3>
          {error && (
            <div style={{ padding: '10px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', fontSize: '12px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          {e.status === 'Draft' && isCreator && (
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

          {e.status === 'Pending Approval' && !activeApproval && (
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px' }}>
              Menunggu persetujuan approver yang ditunjuk.
            </p>
          )}

          {e.status === 'Pending Approval' && activeApproval && (
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

          {e.status === 'Approved' && canFinance && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(handleMarkPaid)}
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

          {e.status === 'Rejected' && (
            <>
              {lastRejected?.notes && (
                <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 12px' }}>
                  Alasan: {lastRejected.notes}
                </p>
              )}
              {isCreator && (
                <Link
                  href={`/expenses/${e.id}/edit`}
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

          {e.status === 'Paid' && (
            <p style={{ fontSize: '13px', color: '#0E7490', margin: 0 }}>
              Pembayaran tercatat{e.payment_date ? ` · ${new Date(e.payment_date).toLocaleDateString('id-ID')}` : ''}
            </p>
          )}
        </div>
      </div>

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
              onChange={e => setRejectReason(e.target.value)}
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
