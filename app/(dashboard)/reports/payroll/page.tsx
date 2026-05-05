// app/(dashboard)/reports/payroll/page.tsx
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { formatIDR } from '@/lib/decimal'
import { payrollLineReportAmounts } from '@/lib/reports/payroll-line-metrics'
import { PayrollReportLinesTable } from '@/components/payroll-report-lines-table'
import type { PayrollRun, PayrollRunLine } from '@/types/database.types'

export const metadata = { title: 'Laporan gaji | Exrok' }

type LineRow = PayrollRunLine & { employee?: { full_name: string } | null }

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) redirect('/expenses')

  const now = new Date()
  const y = parseInt(String(searchParams.year ?? now.getFullYear()), 10)
  const m = parseInt(String(searchParams.month ?? now.getMonth() + 1), 10)
  const periodYear = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear()
  const periodMonth = Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1

  const { data: run } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .maybeSingle()

  let lines: LineRow[] = []
  if (run) {
    const { data: raw } = await supabase
      .from('payroll_run_lines')
      .select('*, employee:employees(full_name)')
      .eq('run_id', run.id)
      .order('created_at')
    lines = (raw ?? []) as LineRow[]
  }

  let totalGross = 0
  let totalDed = 0
  let totalNett = 0
  const detail = lines.map(l => {
    const { gross, deductions, nett } = payrollLineReportAmounts(l)
    totalGross += gross
    totalDed += deductions
    totalNett += nett
    return { line: l, gross, deductions, nett }
  })

  const inp: CSSProperties = {
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: 'inherit',
  }
  const lbl: CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/reports" style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}>
          ← Laporan
        </Link>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Laporan gaji</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Daftar karyawan per periode payroll dengan ringkasan bruto, pemotongan, dan nett.
        </p>
      </div>

      <form
        method="get"
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={lbl}>Bulan</label>
          <select name="month" defaultValue={periodMonth} style={inp}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mon => (
              <option key={mon} value={mon}>
                {String(mon).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Tahun</label>
          <select name="year" defaultValue={periodYear} style={inp}>
            {years.map(yr => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#fff',
            background: '#0F172A',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Tampilkan
        </button>
      </form>

      {!run ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          Belum ada payroll untuk periode {String(periodMonth).padStart(2, '0')}/{periodYear}.
        </div>
      ) : (
        <>
          <div
            style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px 28px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.04em' }}>Periode</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#0C4A6E' }}>
                {String(periodMonth).padStart(2, '0')}/{periodYear} · {(run as PayrollRun).status === 'draft' ? 'Draft' : 'Disubmit'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total bruto</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0C4A6E', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(totalGross)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total pemotongan</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0C4A6E', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(totalDed)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total nett</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0C4A6E', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(totalNett)}</div>
            </div>
          </div>

          <PayrollReportLinesTable detail={detail} />
        </>
      )}
    </div>
  )
}
