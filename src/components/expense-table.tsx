'use client'

// ============================================================
// src/components/expense-table.tsx
// Tabel expense dengan filter, status badge, submit draft (legacy Draft)
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { EXPENSE_STATUS_STYLE } from '@/lib/expense-status-styles'
import { rpcSubmitExpense } from '@/lib/actions/approval.actions'

interface ExpenseRow {
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
  is_reconciled: boolean
  created_at: string
  created_by: string | null
  project: { id: string; name: string } | null
  employee: { id: string; full_name: string } | null
}

interface ExpenseTableProps {
  expenses: ExpenseRow[]
  projects: { id: string; name: string }[]
  userId: string
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  'PO':        { bg: '#EFF6FF', color: '#1D4ED8' },
  'Reimburse': { bg: '#F5F3FF', color: '#6D28D9' },
  'Salary':    { bg: '#ECFDF5', color: '#065F46' },
}

function StatusBadge({ status }: { status: string }) {
  const s = EXPENSE_STATUS_STYLE[status] ?? EXPENSE_STATUS_STYLE['Draft']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: '20px', fontSize: '11px', fontWeight: '500',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_STYLE[type] ?? { bg: '#F1F5F9', color: '#475569' }
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 7px', borderRadius: '4px',
      fontSize: '11px', fontWeight: '500', background: t.bg, color: t.color,
    }}>
      {type}
    </span>
  )
}

export function ExpenseTable({ expenses, projects, userId }: ExpenseTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter client-side
  const filtered = expenses.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false
    if (filterProject && e.project?.id !== filterProject) return false
    if (filterFrom && e.transaction_date < filterFrom) return false
    if (filterTo && e.transaction_date > filterTo) return false
    return true
  })

  async function handleSubmitExpense(id: string) {
    setActionLoading(id)
    setActionError(null)
    const result = await rpcSubmitExpense(id)
    setActionLoading(null)
    if (!result.success) setActionError(result.error ?? 'Gagal submit')
    else startTransition(() => router.refresh())
  }

  const inputStyle = {
    padding: '6px 10px', fontSize: '12px', borderRadius: '7px',
    border: '1px solid #E2E8F0', color: '#334155', outline: 'none',
    background: '#fff', height: '32px',
  }

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px',
        marginBottom: '16px', alignItems: 'center',
      }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">Semua status</option>
          <option value="Draft">Draft</option>
          <option value="Pending Approval">Menunggu</option>
          <option value="Approved">Disetujui</option>
          <option value="Rejected">Ditolak</option>
          <option value="Paid">Dibayar</option>
        </select>

        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={inputStyle}>
          <option value="">Semua proyek</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} placeholder="Dari" />
        <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   style={inputStyle} placeholder="Sampai" />

        {(filterStatus || filterProject || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterProject(''); setFilterFrom(''); setFilterTo('') }}
            style={{ ...inputStyle, cursor: 'pointer', color: '#EF4444', borderColor: '#FECACA', background: '#FEF2F2' }}
          >
            × Reset
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94A3B8' }}>
          {filtered.length} dari {expenses.length} data
        </span>
      </div>

      {/* Error banner */}
      {actionError && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: '13px', color: '#B91C1C' }}>
          {actionError}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            Tidak ada data expense
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Tanggal transaksi', 'Ref / Deskripsi', 'Tipe', 'Proyek', 'Total', 'Status', 'Aksi'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: '11px', fontWeight: '600', color: '#475569',
                      letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') router.push(`/expenses/${row.id}`)
                    }}
                    onClick={() => router.push(`/expenses/${row.id}`)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
                      background: actionLoading === row.id ? '#FAFAFA' : '#fff',
                      transition: 'background .1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (actionLoading !== row.id) (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { if (actionLoading !== row.id) (e.currentTarget as HTMLElement).style.background = '#fff' }}
                  >
                    {/* Tanggal */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {new Date(row.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Ref + Deskripsi */}
                    <td style={{ padding: '11px 14px', maxWidth: '200px' }}>
                      {row.ref_no && (
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px', fontFamily: 'monospace' }}>
                          {row.ref_no}
                        </div>
                      )}
                      <div style={{ color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description ?? '—'}
                      </div>
                      {row.employee && (
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {row.employee.full_name}
                        </div>
                      )}
                    </td>

                    {/* Tipe */}
                    <td style={{ padding: '11px 14px' }}>
                      <TypeBadge type={row.type} />
                    </td>

                    {/* Proyek */}
                    <td style={{ padding: '11px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {row.project?.name ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Total */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: '500', color: '#0F172A', fontSize: '13px' }}>
                        {formatIDR(row.total_payment)}
                      </div>
                      {(parseFloat(row.vat) > 0 || parseFloat(row.admin_fee) > 0 || parseFloat(row.service_fee) > 0) && (
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>
                          DPP {formatIDR(row.amount)}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge status={row.status} />
                      {row.is_reconciled && (
                        <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>✓ Rekonsiliasi</div>
                      )}
                    </td>

                    {/* Aksi */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {row.status === 'Draft' && row.created_by === userId && (
                          <button
                            type="button"
                            onClick={() => void handleSubmitExpense(row.id)}
                            disabled={!!actionLoading}
                            style={{
                              padding: '4px 10px', fontSize: '11px', fontWeight: '500',
                              background: '#0F172A', color: '#fff', border: 'none',
                              borderRadius: '6px', cursor: 'pointer',
                            }}
                          >
                            Submit
                          </button>
                        )}
                        <span
                          style={{
                            padding: '4px 10px', fontSize: '11px', color: '#475569',
                            border: '1px solid #E2E8F0', borderRadius: '6px',
                            display: 'inline-block',
                          }}
                        >
                          Detail
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
