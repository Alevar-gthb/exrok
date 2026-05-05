'use client'

// ============================================================
// src/components/expense-table.tsx
// Tabel expense dengan filter, status badge, submit draft (legacy Draft)
// ============================================================

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { EXPENSE_STATUS_STYLE } from '@/lib/expense-status-styles'
import { rpcSubmitExpense } from '@/lib/actions/approval.actions'
import { SortableTh, StaticTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import {
  compareNum,
  compareText,
  cycleColumnSort,
  parseDecimalString,
} from '@/lib/table-sort'

interface ExpenseRow {
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
  loadMoreHref?: string | null
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

export function ExpenseTable({ expenses, projects, userId, loadMoreHref }: ExpenseTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterSubmissionFrom, setFilterSubmissionFrom] = useState('')
  const [filterSubmissionTo, setFilterSubmissionTo] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })

  const toggleSortColumn = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  // Filter client-side
  const filtered = expenses.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false
    if (filterProject && e.project?.id !== filterProject) return false
    if (filterSubmissionFrom && e.submission_date < filterSubmissionFrom) return false
    if (filterSubmissionTo && e.submission_date > filterSubmissionTo) return false
    return true
  })

  const sortedFiltered = useMemo(() => {
    const key = tableSort.key
    if (!key) return filtered
    const dir = tableSort.dir
    const copy = [...filtered]
    copy.sort((a, b) => {
      switch (key) {
        case 'submission_date':
          return compareText(a.submission_date, b.submission_date, dir)
        case 'transaction_date':
          return compareText(a.transaction_date, b.transaction_date, dir)
        case 'ref_desc': {
          const ta = `${a.ref_no ?? ''} ${a.description ?? ''} ${a.employee?.full_name ?? ''}`
          const tb = `${b.ref_no ?? ''} ${b.description ?? ''} ${b.employee?.full_name ?? ''}`
          return compareText(ta, tb, dir)
        }
        case 'type':
          return compareText(a.type, b.type, dir)
        case 'project':
          return compareText(a.project?.name, b.project?.name, dir)
        case 'total':
          return compareNum(
            parseDecimalString(a.total_payment),
            parseDecimalString(b.total_payment),
            dir,
          )
        case 'status':
          return compareText(a.status, b.status, dir)
        default:
          return 0
      }
    })
    return copy
  }, [filtered, tableSort])

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

        <input
          type="date"
          value={filterSubmissionFrom}
          onChange={e => setFilterSubmissionFrom(e.target.value)}
          style={inputStyle}
          title="Tanggal pengajuan dari"
          aria-label="Tanggal pengajuan dari"
        />
        <input
          type="date"
          value={filterSubmissionTo}
          onChange={e => setFilterSubmissionTo(e.target.value)}
          style={inputStyle}
          title="Tanggal pengajuan sampai"
          aria-label="Tanggal pengajuan sampai"
        />

        {(filterStatus || filterProject || filterSubmissionFrom || filterSubmissionTo) && (
          <button
            onClick={() => {
              setFilterStatus('')
              setFilterProject('')
              setFilterSubmissionFrom('')
              setFilterSubmissionTo('')
            }}
            style={{ ...inputStyle, cursor: 'pointer', color: '#EF4444', borderColor: '#FECACA', background: '#FEF2F2' }}
          >
            × Reset
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94A3B8' }}>
          {sortedFiltered.length} dari {expenses.length} data
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
        {sortedFiltered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            Tidak ada data expense
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <SortableTh
                    label="Tanggal pengajuan"
                    columnKey="submission_date"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Tanggal transaksi"
                    columnKey="transaction_date"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Ref / Deskripsi"
                    columnKey="ref_desc"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Tipe"
                    columnKey="type"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Proyek"
                    columnKey="project"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Total"
                    columnKey="total"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="number"
                  />
                  <SortableTh
                    label="Status"
                    columnKey="status"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <StaticTh>Aksi</StaticTh>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((row, i) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') router.push(`/expenses/${row.id}`)
                    }}
                    onClick={() => router.push(`/expenses/${row.id}`)}
                    style={{
                      borderBottom: i < sortedFiltered.length - 1 ? '1px solid #F1F5F9' : 'none',
                      background: actionLoading === row.id ? '#FAFAFA' : '#fff',
                      transition: 'background .1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (actionLoading !== row.id) (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { if (actionLoading !== row.id) (e.currentTarget as HTMLElement).style.background = '#fff' }}
                  >
                    {/* Tanggal Pengajuan */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {new Date(row.submission_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

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
      {loadMoreHref && (
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          <a
            href={loadMoreHref}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              color: '#334155',
              textDecoration: 'none',
              background: '#fff',
            }}
          >
            Muat data berikutnya
          </a>
        </div>
      )}
    </div>
  )
}
