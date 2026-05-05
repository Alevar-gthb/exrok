'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PayrollImportSummary } from '@/types/payroll-import'
import { createClient } from '@/supabase/client'

export function PayrollImportForm() {
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [mode, setMode] = useState<'dry-run' | 'commit'>('dry-run')
  const [tolerance, setTolerance] = useState('500')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<PayrollImportSummary | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: string
    stage: string
    message: string | null
    rows: number
    sheets: number
  } | null>(null)

  const topIssues = useMemo(() => summary?.issues.slice(0, 12) ?? [], [summary])

  useEffect(() => {
    if (!jobId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`payroll-import-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_import_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          setProgress({
            status: String(row.status ?? ''),
            stage: String(row.stage ?? ''),
            message: row.message ? String(row.message) : null,
            rows: Number(row.rows_processed ?? 0),
            sheets: Number(row.sheets_processed ?? 0),
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [jobId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSummary(null)
    setProgress(null)
    if (!file) {
      setError('Pilih file Excel dulu.')
      return
    }
    setLoading(true)
    const form = new FormData()
    const generatedJobId = crypto.randomUUID()
    setJobId(generatedJobId)
    form.append('file', file)
    form.append('year', year)
    form.append('mode', mode)
    form.append('mismatchTolerance', tolerance)
    form.append('job_id', generatedJobId)

    try {
      const res = await fetch('/api/payroll/import', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Gagal import payroll')
      }
      setSummary(json.data as PayrollImportSummary)
      if (json.jobId) setJobId(String(json.jobId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginBottom: '20px',
        padding: '16px 18px',
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <h3 style={{ margin: 0, marginBottom: '8px', fontSize: '14px', color: '#0F172A' }}>Import payroll dari Excel</h3>
      <p style={{ margin: 0, marginBottom: '14px', fontSize: '12px', color: '#64748B' }}>
        Gunakan dry-run untuk cek mismatch PPh21 (hybrid TER), lalu commit jika hasil valid.
      </p>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <a href="/api/payroll/import/template" style={btnSecondary}>
          Download template payroll terbaru
        </a>
        <span style={{ fontSize: '12px', color: '#64748B', alignSelf: 'center' }}>
          Kolom <strong>Project List</strong>: isi nama project dipisah koma. Contoh: Project A, Project B
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#475569' }}>Tahun</label>
          <input value={year} onChange={e => setYear(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#475569' }}>Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'dry-run' | 'commit')} style={inp}>
            <option value="dry-run">Dry-run (validasi)</option>
            <option value="commit">Commit (simpan ke DB)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#475569' }}>Tolerance gap (Rp)</label>
          <input value={tolerance} onChange={e => setTolerance(e.target.value.replace(/[^0-9]/g, ''))} style={inp} />
        </div>
        <div style={{ minWidth: '280px' }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#475569' }}>File .xlsx</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ ...inp, padding: '6px 8px', width: '100%' }}
          />
        </div>
        <button type="submit" disabled={loading} style={btnPrimary}>
          {loading ? 'Memproses…' : mode === 'dry-run' ? 'Run validasi' : 'Commit import'}
        </button>
      </div>

      {error && <p style={{ marginTop: 10, marginBottom: 0, fontSize: '12px', color: '#B91C1C' }}>{error}</p>}
      {progress && (
        <div style={{ marginTop: 10, fontSize: '12px', color: '#334155' }}>
          <strong>Status:</strong> {progress.status} · <strong>Stage:</strong> {progress.stage}
          {progress.message ? ` · ${progress.message}` : ''}
          <div style={{ marginTop: '4px' }}>
            Sheets: {progress.sheets} · Rows: {progress.rows}
          </div>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 14, padding: 12, border: '1px solid #E2E8F0', borderRadius: 10, background: '#F8FAFC' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '12px', color: '#334155' }}>
            <span>Sheets: {summary.sheetsProcessed}</span>
            <span>Rows: {summary.rowsProcessed}</span>
            <span>Employees: {summary.employeesUpserted}</span>
            <span>Components: {summary.componentsUpserted}</span>
            <span>Payroll lines: {summary.payrollLinesUpserted}</span>
            <span>Warnings: {summary.warnings}</span>
            <span>Errors: {summary.errors}</span>
            <span>Mismatch: {summary.mismatchCount}</span>
          </div>
          {topIssues.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 220, overflow: 'auto', fontSize: '12px' }}>
              {topIssues.map((i, idx) => (
                <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid #E2E8F0' }}>
                  <strong style={{ color: i.level === 'error' ? '#B91C1C' : '#92400E' }}>{i.level.toUpperCase()}</strong>{' '}
                  row {i.rowNumber} / {i.employeeName}: {i.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  )
}

const inp: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: '12px',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#fff',
  background: '#0F172A',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#0F172A',
  background: '#F8FAFC',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}
