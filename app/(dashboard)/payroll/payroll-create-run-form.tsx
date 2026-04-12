'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPayrollRun } from '@/lib/actions/payroll.actions'

export function PayrollCreateRunForm() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      setErr('Periode tidak valid')
      setLoading(false)
      return
    }
    const r = await createPayrollRun(y, m)
    setLoading(false)
    if (!r.success || !r.data) setErr(r.error ?? 'Gagal membuat payroll')
    else router.push(`/payroll/${r.data.id}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end',
        marginBottom: '24px',
        padding: '16px 18px',
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
          Tahun
        </label>
        <input
          value={year}
          onChange={e => setYear(e.target.value)}
          style={{
            width: '100px',
            padding: '8px 12px',
            fontSize: '13px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
          Bulan
        </label>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{
            width: '120px',
            padding: '8px 12px',
            fontSize: '13px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {String(i + 1).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '9px 18px',
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          background: loading ? '#94A3B8' : '#0F172A',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Membuat…' : 'Generate payroll'}
      </button>
      {err && <span style={{ fontSize: '12px', color: '#DC2626', alignSelf: 'center' }}>{err}</span>}
    </form>
  )
}
