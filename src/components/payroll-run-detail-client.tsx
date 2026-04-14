'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  deletePayrollRunDraft,
  recalcPayrollLineAmountFromAdjustments,
  submitPayrollRun,
  updatePayrollRunLine,
} from '@/lib/actions/payroll.actions'
import { parsePayrollAdjustments } from '@/lib/payroll-helpers'
import { formatIDR } from '@/lib/decimal'
import type { PayrollLineAdjustment, PayrollRun, PayrollRunLine, Project } from '@/types/database.types'

export type PayrollLineRow = PayrollRunLine & {
  employee?: { full_name: string } | null
}

const inp: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  border: '1px solid #E2E8F0',
  borderRadius: '6px',
  outline: 'none',
  fontFamily: 'inherit',
}

export function PayrollRunDetailClient({
  initialRun,
  initialLines,
  projects,
  myRole,
}: {
  initialRun: PayrollRun
  initialLines: PayrollLineRow[]
  projects: Pick<Project, 'id' | 'name'>[]
  myRole: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [adjForm, setAdjForm] = useState({
    lineId: '',
    code: 'ADJ',
    label: '',
    kind: 'earning' as 'earning' | 'deduction',
    amount: '',
  })

  const lines = useMemo(
    () =>
      initialLines.map(l => ({
        ...l,
        adjustments: parsePayrollAdjustments(l.adjustments as unknown),
      })),
    [initialLines]
  )

  const periodLabel = `${String(initialRun.period_month).padStart(2, '0')}/${initialRun.period_year}`

  async function saveLineProject(lineId: string, projectId: string | null) {
    setError(null)
    const r = await updatePayrollRunLine(lineId, { project_id: projectId })
    if (!r.success) setError(r.error ?? 'Gagal simpan')
    else startTransition(() => router.refresh())
  }

  async function saveLineAmount(lineId: string, amount: string) {
    setError(null)
    const r = await updatePayrollRunLine(lineId, { amount })
    if (!r.success) setError(r.error ?? 'Gagal simpan')
    else startTransition(() => router.refresh())
  }

  async function addAdjustment(e: React.FormEvent) {
    e.preventDefault()
    if (!adjForm.lineId || !adjForm.label || !adjForm.amount) return
    const line = lines.find(l => l.id === adjForm.lineId)
    if (!line) return
    const digits = adjForm.amount.replace(/\D/g, '')
    const normalized = digits ? parseInt(digits, 10).toFixed(2) : '0'
    const next: PayrollLineAdjustment[] = [
      ...line.adjustments,
      {
        code: adjForm.code || 'ADJ',
        label: adjForm.label,
        kind: adjForm.kind,
        amount: normalized,
      },
    ]
    setError(null)
    const u = await updatePayrollRunLine(adjForm.lineId, { adjustments: next })
    if (!u.success) {
      setError(u.error ?? 'Gagal')
      return
    }
    const r = await recalcPayrollLineAmountFromAdjustments(adjForm.lineId)
    if (!r.success) setError(r.error ?? 'Gagal hitung ulang')
    else {
      setAdjForm({ lineId: '', code: 'ADJ', label: '', kind: 'earning', amount: '' })
      startTransition(() => router.refresh())
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const r = await submitPayrollRun(initialRun.id)
    setSubmitting(false)
    if (!r.success) setError(r.error ?? 'Gagal submit')
    else startTransition(() => router.refresh())
  }

  async function handleDeleteDraft() {
    if (!confirm('Hapus draft payroll ini?')) return
    setError(null)
    const r = await deletePayrollRunDraft(initialRun.id)
    if (!r.success) setError(r.error ?? 'Gagal hapus')
    else router.push('/payroll')
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/payroll" style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none' }}>
          ← Daftar payroll
        </Link>
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>
        Payroll {periodLabel}
      </h1>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
        Status: <strong>{initialRun.status === 'draft' ? 'Draft' : 'Disubmit'}</strong>
        {isPending ? ' · Memuat…' : ''}
      </p>
      {error && (
        <p style={{ fontSize: '13px', color: '#DC2626', marginBottom: '12px', padding: '10px 12px', background: '#FEF2F2', borderRadius: '8px' }}>
          {error}
        </p>
      )}

      {initialRun.status === 'draft' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#fff',
              background: submitting ? '#94A3B8' : '#0F172A',
              border: 'none',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Memproses…' : 'Catatkan ke pengeluaran & kirim approval'}
          </button>
          {myRole === 'owner' && (
            <button
              type="button"
              onClick={handleDeleteDraft}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#991B1B',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Hapus draft
            </button>
          )}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>Baris per karyawan</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#475569' }}>Karyawan</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#475569' }}>Proyek</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: '#475569' }}>Net</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: '#475569' }}>PPh21 (Excel/System)</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#475569' }}>Expense</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: '500', color: '#0F172A' }}>{line.employee?.full_name ?? '—'}</div>
                    {line.adjustments.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '11px', color: '#64748B' }}>
                        {line.adjustments.map((a, i) => (
                          <li key={i}>
                            {a.label} ({a.kind}) {formatIDR(a.amount)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {initialRun.status === 'draft' && !line.expense_id ? (
                      <ProjectSelect
                        value={line.project_id}
                        projects={projects}
                        onSave={pid => saveLineProject(line.id, pid)}
                      />
                    ) : (
                      <span style={{ color: '#64748B' }}>{line.project_id ? projects.find(p => p.id === line.project_id)?.name ?? line.project_id : '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    {initialRun.status === 'draft' && !line.expense_id ? (
                      <AmountEdit initial={line.amount} onSave={amt => saveLineAmount(line.id, amt)} />
                    ) : (
                      formatIDR(line.amount)
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                    {line.pph21_excel && line.pph21_system ? (
                      <div>
                        <div>{formatIDR(line.pph21_excel)}</div>
                        <div>{formatIDR(line.pph21_system)}</div>
                        {line.pph21_gap && Number(line.pph21_gap) !== 0 && (
                          <div style={{ color: Math.abs(Number(line.pph21_gap)) > 500 ? '#B45309' : '#64748B' }}>
                            gap {formatIDR(line.pph21_gap)}
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                    {line.expense_id ? (
                      <Link href={`/expenses/${line.expense_id}`} style={{ color: '#2563EB' }}>
                        Lihat expense
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {initialRun.status === 'draft' && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '20px',
            maxWidth: '520px',
          }}
        >
          <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 12px', color: '#0F172A' }}>
            Tambah penyesuaian (lembur, bonus, potongan)
          </h3>
          <form onSubmit={addAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Baris</label>
              <select
                style={{ ...inp, width: '100%' }}
                value={adjForm.lineId}
                onChange={e => setAdjForm(f => ({ ...f, lineId: e.target.value }))}
                required
              >
                <option value="">— Pilih karyawan —</option>
                {lines
                  .filter(l => !l.expense_id)
                  .map(l => (
                    <option key={l.id} value={l.id}>
                      {l.employee?.full_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Label</label>
              <input style={{ ...inp, width: '100%' }} value={adjForm.label} onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))} placeholder="Lembur April" />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Jenis</label>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={adjForm.kind}
                  onChange={e => setAdjForm(f => ({ ...f, kind: e.target.value as 'earning' | 'deduction' }))}
                >
                  <option value="earning">Tambah (earning)</option>
                  <option value="deduction">Potong (deduction)</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Nominal (Rp)</label>
                <input
                  style={{ ...inp, width: '100%' }}
                  value={adjForm.amount}
                  onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="500000"
                />
              </div>
            </div>
            <button
              type="submit"
              style={{
                marginTop: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: '#2563EB',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              Tambah & hitung ulang net
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ProjectSelect({
  value,
  projects,
  onSave,
}: {
  value: string | null
  projects: Pick<Project, 'id' | 'name'>[]
  onSave: (projectId: string | null) => void
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => {
    setV(value ?? '')
  }, [value])
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select style={{ ...inp, minWidth: '140px' }} value={v} onChange={e => setV(e.target.value)}>
        <option value="">—</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }} onClick={() => onSave(v || null)}>
        OK
      </button>
    </div>
  )
}

function AmountEdit({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  useEffect(() => {
    setV(initial)
  }, [initial])
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
      <input
        style={{ ...inp, width: '100px', textAlign: 'right' }}
        value={v}
        onChange={e => setV(e.target.value.replace(/[^0-9.]/g, ''))}
      />
      <button type="button" style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }} onClick={() => onSave(v)}>
        OK
      </button>
    </div>
  )
}
