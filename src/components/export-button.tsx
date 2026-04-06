'use client'

import { useState } from 'react'

export function ExportButton() {
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function handleExport() {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    try {
      const res = await fetch(`/api/reports/export?${params}`)
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `exrok-expense-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export gagal')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }}>Dari Tanggal</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }}>Sampai Tanggal</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
        </div>
      </div>
      <button onClick={handleExport} disabled={loading}
        style={{ padding: '9px 20px', fontSize: '13px', fontWeight: '500', background: loading ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {loading ? '⏳ Mengexport...' : '⬇ Download Excel (.xlsx)'}
      </button>
    </div>
  )
}
