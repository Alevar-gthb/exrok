'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { findMatchingRule } from '@/lib/approval-rule-match'
import type { ApprovalRule } from '@/types/database.types'
import {
  createApprovalRule,
  deleteApprovalRule,
  updateApprovalRule,
} from '@/lib/actions/approval-rules.actions'

function formatAmountCondition(r: ApprovalRule): string {
  const min = parseFloat(r.min_amount)
  const max = r.max_amount != null && r.max_amount !== '' ? parseFloat(r.max_amount) : null
  if (min <= 0 && max != null) return `< ${formatIDR(String(max))}`
  if (max == null && min > 0) return `> ${formatIDR(String(min))}`
  if (max != null) return `${formatIDR(String(min))} – ${formatIDR(String(max))}`
  return `≥ ${formatIDR(String(min))}`
}

interface ApproverOpt {
  id: string
  full_name: string
  email: string | null
  role: string
}

interface Props {
  initialRules: ApprovalRule[]
  approvers: ApproverOpt[]
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  outline: 'none',
}

export function ApprovalRulesClient({ initialRules, approvers }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [minAmount, setMinAmount] = useState('0')
  const [maxAmount, setMaxAmount] = useState('')
  const [bu, setBu] = useState<'all' | 'RKT' | 'SPH'>('all')
  const [et, setEt] = useState<'all' | 'PO' | 'Reimburse' | 'Salary'>('all')
  const [requireApproval, setRequireApproval] = useState(true)
  const [approverId, setApproverId] = useState('')
  const [priority, setPriority] = useState(0)

  const [simAmount, setSimAmount] = useState('')
  const [simBu, setSimBu] = useState<'RKT' | 'SPH'>('RKT')
  const [simEt, setSimEt] = useState<'PO' | 'Reimburse' | 'Salary'>('PO')
  const simResult = useMemo(() => {
    const n = parseFloat(simAmount.replace(/[^0-9.]/g, ''))
    if (isNaN(n) || n < 0) return null
    return findMatchingRule(initialRules, n, simBu, simEt)
  }, [initialRules, simAmount, simBu, simEt])

  function openAdd() {
    setEditingId(null)
    setName('')
    setMinAmount('0')
    setMaxAmount('')
    setBu('all')
    setEt('all')
    setRequireApproval(true)
    setApproverId(approvers[0]?.id ?? '')
    setPriority(initialRules.length ? Math.min(...initialRules.map(r => r.priority)) - 1 : 0)
    setModal('add')
  }

  function openEdit(r: ApprovalRule) {
    setEditingId(r.id)
    setName(r.name)
    setMinAmount(r.min_amount)
    setMaxAmount(r.max_amount ?? '')
    setBu(!r.business_unit ? 'all' : r.business_unit)
    setEt(!r.expense_type ? 'all' : r.expense_type)
    setRequireApproval(r.require_approval)
    setApproverId(r.approver_employee_id ?? '')
    setPriority(r.priority)
    setModal('edit')
  }

  async function saveRule() {
    setError(null)
    if (!name.trim()) {
      setError('Nama wajib diisi')
      return
    }
    const min = parseFloat(minAmount)
    const max = maxAmount === '' ? null : parseFloat(maxAmount)
    if (!isNaN(max ?? NaN) && max != null && max < min) {
      setError('Min tidak boleh lebih besar dari max')
      return
    }
    if (requireApproval && !approverId) {
      setError('Pilih approver jika perlu approval manual')
      return
    }

    const payload = {
      name: name.trim(),
      business_unit: bu === 'all' ? null : bu,
      expense_type: et === 'all' ? null : et,
      min_amount: String(min),
      max_amount: max == null || maxAmount === '' ? null : String(max),
      require_approval: requireApproval,
      approver_employee_id: requireApproval ? approverId : null,
      priority,
      is_active: true,
    }

    setLoading(true)
    try {
      if (modal === 'add') {
        const res = await createApprovalRule(payload)
        if (!res.success) setError(res.error ?? 'Gagal')
        else {
          setModal(null)
          router.refresh()
        }
      } else if (modal === 'edit' && editingId) {
        const res = await updateApprovalRule(editingId, payload)
        if (!res.success) setError(res.error ?? 'Gagal')
        else {
          setModal(null)
          router.refresh()
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(r: ApprovalRule) {
    setError(null)
    setLoading(true)
    try {
      const res = await updateApprovalRule(r.id, { is_active: !r.is_active })
      if (!res.success) setError(res.error ?? 'Gagal')
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus rule ini?')) return
    setError(null)
    setLoading(true)
    try {
      const res = await deleteApprovalRule(id)
      if (!res.success) setError(res.error ?? 'Gagal — mungkin masih dipakai riwayat approval')
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Approval Rules</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Atur siapa yang meng-approve expense berdasarkan jumlah</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          style={{
            padding: '8px 16px',
            background: '#0F172A',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Tambah Rule
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Prioritas', 'Nama', 'Amount', 'Tipe / BU', 'Approver', 'Approval', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...initialRules].sort((a, b) => a.priority - b.priority).map(r => {
              const ap = approvers.find(x => x.id === r.approver_employee_id)
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px' }}>{r.priority}</td>
                  <td style={{ padding: '10px 12px' }}>{r.name}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatAmountCondition(r)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>
                    {r.expense_type ?? 'Semua'} / {r.business_unit ?? 'Semua'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{ap?.full_name ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: r.require_approval ? '#FFFBEB' : '#F0FDF4',
                        color: r.require_approval ? '#92400E' : '#166534',
                        border: `1px solid ${r.require_approval ? '#FCD34D' : '#86EFAC'}`,
                      }}
                    >
                      {r.require_approval ? 'Manual' : 'Auto-approve'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={r.is_active} onChange={() => void toggleActive(r)} disabled={loading} />
                      <span style={{ fontSize: '12px' }}>{r.is_active ? 'Aktif' : 'Off'}</span>
                    </label>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => openEdit(r)} style={{ marginRight: '8px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => remove(r.id)} style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer' }}>
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px' }}>Cek Rule untuk Expense</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#64748B' }}>Amount (Rp)</label>
            <input value={simAmount} onChange={e => setSimAmount(e.target.value)} style={{ ...inp, width: '140px', display: 'block', marginTop: '4px' }} placeholder="100000" />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#64748B' }}>BU</label>
            <select value={simBu} onChange={e => setSimBu(e.target.value as 'RKT' | 'SPH')} style={{ ...inp, width: '120px', display: 'block', marginTop: '4px' }}>
              <option value="RKT">RKT</option>
              <option value="SPH">SPH</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#64748B' }}>Tipe</label>
            <select value={simEt} onChange={e => setSimEt(e.target.value as 'PO' | 'Reimburse' | 'Salary')} style={{ ...inp, width: '140px', display: 'block', marginTop: '4px' }}>
              <option value="PO">PO</option>
              <option value="Reimburse">Reimburse</option>
              <option value="Salary">Salary</option>
            </select>
          </div>
        </div>
        {simResult ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#0F172A' }}>
            Rule: <strong>{simResult.name}</strong>
            {' · '}
            {simResult.require_approval ? (
              <>Approver: {approvers.find(a => a.id === simResult.approver_employee_id)?.full_name ?? '—'}</>
            ) : (
              <>Auto-approve</>
            )}
          </p>
        ) : simAmount ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>Tidak ada rule yang cocok (akan status Submitted)</p>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>Isi amount untuk simulasi</p>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '22px', maxWidth: '440px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>{modal === 'add' ? 'Tambah Rule' : 'Edit Rule'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#475569' }}>Nama rule</label>
                <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, marginTop: '4px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#475569' }}>Dari (Rp)</label>
                  <input value={minAmount} onChange={e => setMinAmount(e.target.value)} style={{ ...inp, marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#475569' }}>Sampai (Rp, kosong = tak terbatas)</label>
                  <input value={maxAmount} onChange={e => setMaxAmount(e.target.value)} style={{ ...inp, marginTop: '4px' }} placeholder="Tidak terbatas" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#475569' }}>Business Unit</label>
                <select value={bu} onChange={e => setBu(e.target.value as 'all' | 'RKT' | 'SPH')} style={{ ...inp, marginTop: '4px' }}>
                  <option value="all">Semua</option>
                  <option value="RKT">RKT</option>
                  <option value="SPH">SPH</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#475569' }}>Tipe expense</label>
                <select value={et} onChange={e => setEt(e.target.value as typeof et)} style={{ ...inp, marginTop: '4px' }}>
                  <option value="all">Semua</option>
                  <option value="PO">PO</option>
                  <option value="Reimburse">Reimburse</option>
                  <option value="Salary">Salary</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={requireApproval} onChange={e => setRequireApproval(e.target.checked)} />
                Perlu approval manual?
              </label>
              {requireApproval && (
                <div>
                  <label style={{ fontSize: '12px', color: '#475569' }}>Approver</label>
                  <select value={approverId} onChange={e => setApproverId(e.target.value)} style={{ ...inp, marginTop: '4px' }}>
                    <option value="">Pilih…</option>
                    {approvers.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: '12px', color: '#475569' }}>Prioritas (lebih kecil = dicek lebih dulu)</label>
                <input type="number" value={priority} onChange={e => setPriority(parseInt(e.target.value, 10) || 0)} style={{ ...inp, marginTop: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}>
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void saveRule()}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#0F172A', color: '#fff', cursor: 'pointer' }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
