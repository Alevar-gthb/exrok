'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { rpcBulkProcessApproval, rpcProcessApproval } from '@/lib/actions/approval.actions'

export type ApprovalInboxRow = {
  id: string
  status: string
  created_at: string
  approval_rule: { id: string; name: string } | null
  expense: {
    id: string
    ref_no: string | null
    description: string | null
    type: string
    amount: string
    total_payment: string
    business_unit: string | null
    department: string | null
    transaction_date: string
    created_at: string
    employee: { id: string; full_name: string } | null
  } | null
}

interface Props {
  rows: ApprovalInboxRow[]
  /** embedded = di dalam Dashboard (heading lebih ringkas) */
  variant?: 'page' | 'embedded'
}

export function ApprovalsInboxClient({ rows, variant = 'page' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [filterType, setFilterType] = useState('')
  const [filterBu, setFilterBu] = useState('')
  const [filterMin, setFilterMin] = useState('')
  const [filterMax, setFilterMax] = useState('')
  const [rejectModal, setRejectModal] = useState<{ ids: string[] } | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')

  const filtered = useMemo(() => {
    return rows.filter((r: ApprovalInboxRow) => {
      const e = r.expense
      if (!e) return false
      if (filterType && e.type !== filterType) return false
      if (filterBu && (e.business_unit ?? '') !== filterBu) return false
      const tp = parseFloat(e.total_payment)
      if (filterMin && tp < parseFloat(filterMin)) return false
      if (filterMax && tp > parseFloat(filterMax)) return false
      return true
    })
  }, [rows, filterType, filterBu, filterMin, filterMax])

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
  const selectedTotal = useMemo(() => {
    let s = 0
    for (const id of selectedIds) {
      const r = filtered.find(x => x.id === id)
      if (r?.expense) s += parseFloat(r.expense.total_payment)
    }
    return s
  }, [filtered, selectedIds])

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length

  function toggleAll() {
    if (allSelected) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      filtered.forEach(r => { next[r.id] = true })
      setSelected(next)
    }
  }

  async function approveOne(id: string) {
    setError(null)
    setLoading(true)
    try {
      const res = await rpcProcessApproval(id, 'approve', null)
      if (!res.success) setError(res.error ?? 'Gagal')
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function rejectOne(id: string) {
    setError(null)
    setLoading(true)
    try {
      const res = await rpcProcessApproval(id, 'reject', rejectNotes || null)
      setRejectModal(null)
      setRejectNotes('')
      if (!res.success) setError(res.error ?? 'Gagal')
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function bulk(action: 'approve' | 'reject', idsOverride?: string[]) {
    const ids = idsOverride ?? selectedIds
    if (ids.length === 0) return
    setError(null)
    setLoading(true)
    try {
      const res = await rpcBulkProcessApproval(ids, action, action === 'reject' ? rejectNotes || null : null)
      setRejectModal(null)
      setRejectNotes('')
      setSelected({})
      if (!res.success) setError(res.error ?? 'Gagal')
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const embedded = variant === 'embedded'

  const inp: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '7px',
    border: '1px solid #E2E8F0',
    background: '#fff',
    height: '32px',
  }

  return (
    <div style={{ paddingBottom: embedded ? '32px' : '80px' }}>
      <div style={{ marginBottom: embedded ? '14px' : '20px' }}>
        {embedded ? (
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>
            Menunggu persetujuan Anda
          </h2>
        ) : (
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Approval Inbox</h1>
        )}
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          {rows.length} expense menunggu persetujuan Anda
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp}>
          <option value="">Semua tipe</option>
          <option value="PO">PO</option>
          <option value="Reimburse">Reimburse</option>
          <option value="Salary">Salary</option>
        </select>
        <select value={filterBu} onChange={e => setFilterBu(e.target.value)} style={inp}>
          <option value="">Semua BU</option>
          <option value="RKT">RKT</option>
          <option value="SPH">SPH</option>
        </select>
        <input type="number" placeholder="Min amount" value={filterMin} onChange={e => setFilterMin(e.target.value)} style={{ ...inp, width: '110px' }} />
        <input type="number" placeholder="Max amount" value={filterMax} onChange={e => setFilterMax(e.target.value)} style={{ ...inp, width: '110px' }} />
        <button
          type="button"
          disabled={selectedIds.length === 0 || loading}
          onClick={() => void bulk('approve')}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            fontSize: '12px',
            borderRadius: '7px',
            border: '1px solid #86EFAC',
            background: '#F0FDF4',
            color: '#166534',
            cursor: selectedIds.length ? 'pointer' : 'not-allowed',
          }}
        >
          Approve Terpilih ({selectedIds.length})
        </button>
        <button
          type="button"
          disabled={selectedIds.length === 0 || loading}
          onClick={() => setRejectModal({ ids: selectedIds })}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            borderRadius: '7px',
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            color: '#991B1B',
            cursor: selectedIds.length ? 'pointer' : 'not-allowed',
          }}
        >
          Tolak Terpilih
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '10px 12px', width: '36px' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#475569' }}>Deskripsi / Pengaju</th>
              <th style={{ padding: '10px 12px' }}>Tipe</th>
              <th style={{ padding: '10px 12px' }}>Amount</th>
              <th style={{ padding: '10px 12px' }}>BU</th>
              <th style={{ padding: '10px 12px' }}>Tanggal</th>
              <th style={{ padding: '10px 12px' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const e = r.expense
              if (!e) return null
              const isSel = !!selected[r.id]
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/expenses/${e.id}`)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
                    background: isSel ? '#EFF6FF' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '10px 12px' }} onClick={ev => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => setSelected(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                    <div style={{ fontWeight: '500', color: '#0F172A' }}>{e.description ?? '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{e.employee?.full_name ?? '—'}</div>
                    {r.approval_rule && <div style={{ fontSize: '10px', color: '#64748B' }}>{r.approval_rule.name}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{e.type}</td>
                  <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(e.total_payment)}</td>
                  <td style={{ padding: '10px 12px' }}>{e.business_unit ?? '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {new Date(e.transaction_date).toLocaleDateString('id-ID')}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }} onClick={ev => ev.stopPropagation()}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void approveOne(r.id)}
                      style={{ marginRight: '6px', padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #86EFAC', background: '#F0FDF4', cursor: 'pointer' }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setRejectModal({ ids: [r.id] })}
                      style={{ marginRight: '6px', padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                    <a
                      href={`/expenses/${e.id}`}
                      style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #E2E8F0', textDecoration: 'none', color: '#475569' }}
                    >
                      ↗
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>Tidak ada approval pending</div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0F172A',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 60,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '90vw',
          }}
        >
          <span style={{ fontSize: '13px' }}>
            {selectedIds.length} dipilih · Total {formatIDR(String(selectedTotal))}
          </span>
          <button type="button" disabled={loading} onClick={() => void bulk('approve')} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#22C55E', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
            Approve
          </button>
          <button type="button" disabled={loading} onClick={() => setRejectModal({ ids: selectedIds })} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
            Tolak
          </button>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%' }}>
            <h4 style={{ margin: '0 0 10px' }}>Tolak approval</h4>
            <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3} placeholder="Alasan (opsional)" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setRejectModal(null); setRejectNotes('') }} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}>
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (rejectModal.ids.length === 1) void rejectOne(rejectModal.ids[0])
                  else void bulk('reject', rejectModal.ids)
                }}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#991B1B', color: '#fff', cursor: 'pointer' }}
              >
                Konfirmasi tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
