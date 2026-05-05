// app/(dashboard)/reports/payments/page.tsx
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { formatIDR } from '@/lib/decimal'
import { PAYMENT_METHODS } from '@/lib/validations/expense.schema'
import { PaymentsReportTable } from '@/components/payments-report-table'

export const metadata = { title: 'Laporan pembayaran | Exrok' }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function monthRange(y: number, m: number) {
  const from = `${y}-${pad2(m)}-01`
  const lastD = new Date(y, m, 0).getDate()
  const to = `${y}-${pad2(m)}-${pad2(lastD)}`
  return { from, to }
}

function defaultRange() {
  const d = new Date()
  return monthRange(d.getFullYear(), d.getMonth() + 1)
}

type PayRow = {
  id: string
  created_at: string
  ref_no: string | null
  payment_date: string | null
  transaction_date: string
  type: string
  total_payment: string | null
  description: string | null
  business_unit: string | null
  payment_method: string | null
  project_id: string | null
  project: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

export default async function PaymentsReportPage({
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

  const def = defaultRange()
  const from = typeof searchParams.from === 'string' && searchParams.from ? searchParams.from : def.from
  const to = typeof searchParams.to === 'string' && searchParams.to ? searchParams.to : def.to
  const bu = typeof searchParams.bu === 'string' && ['RKT', 'SPH'].includes(searchParams.bu) ? searchParams.bu : ''
  const type = typeof searchParams.type === 'string' && ['PO', 'Reimburse', 'Salary'].includes(searchParams.type) ? searchParams.type : ''
  const paymentMethodRaw = typeof searchParams.pm === 'string' ? searchParams.pm : ''
  const paymentMethodNone = paymentMethodRaw === '__none__'
  const paymentMethod = !paymentMethodNone && (PAYMENT_METHODS as readonly string[]).includes(paymentMethodRaw) ? paymentMethodRaw : ''
  const projectRaw = typeof searchParams.project_id === 'string' ? searchParams.project_id : ''
  const projectNone = projectRaw === '__none__'
  const projectId = projectRaw && !projectNone && /^[0-9a-f-]{36}$/i.test(projectRaw) ? projectRaw : ''

  const pageSize = Math.min(Math.max(Number(typeof searchParams.limit === 'string' ? searchParams.limit : '120') || 120, 20), 300)
  const cursorCreatedAt = typeof searchParams.cursor_created_at === 'string' ? searchParams.cursor_created_at : ''
  const cursorId = typeof searchParams.cursor_id === 'string' ? searchParams.cursor_id : ''

  let query = supabase
    .from('expenses')
    .select(
      `
      id, created_at, ref_no, payment_date, transaction_date, type, total_payment, description, business_unit, payment_method, project_id,
      project:projects(id, name),
      category:expense_categories(id, name)
    `,
    )
    .eq('status', 'Paid')
    .not('payment_date', 'is', null)
    .gte('payment_date', from)
    .lte('payment_date', to)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)

  if (bu) query = query.eq('business_unit', bu as 'RKT' | 'SPH')
  if (type) query = query.eq('type', type as 'PO' | 'Reimburse' | 'Salary')
  if (paymentMethodNone) query = query.is('payment_method', null)
  else if (paymentMethod) query = query.eq('payment_method', paymentMethod)
  if (projectNone) query = query.is('project_id', null)
  else if (projectId) query = query.eq('project_id', projectId)
  if (cursorCreatedAt && cursorId) {
    query = query.or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`)
  }

  const { data: rowsRaw } = await query
  const hasMore = (rowsRaw?.length ?? 0) > pageSize
  const pageRows = hasMore ? (rowsRaw ?? []).slice(0, pageSize) : (rowsRaw ?? [])
  const rows = pageRows as unknown as PayRow[]
  const last = rows.length > 0 ? rows[rows.length - 1] : null
  const nextParams = new URLSearchParams()
  nextParams.set('from', from)
  nextParams.set('to', to)
  if (bu) nextParams.set('bu', bu)
  if (type) nextParams.set('type', type)
  if (paymentMethodNone) nextParams.set('pm', '__none__')
  else if (paymentMethod) nextParams.set('pm', paymentMethod)
  if (projectNone) nextParams.set('project_id', '__none__')
  else if (projectId) nextParams.set('project_id', projectId)
  nextParams.set('limit', String(pageSize))
  if (hasMore && last) {
    nextParams.set('cursor_created_at', last.created_at)
    nextParams.set('cursor_id', last.id)
  }
  const loadMoreHref = hasMore && last ? `/reports/payments?${nextParams.toString()}` : null

  const { data: projects } = await supabase.from('projects').select('id, name').eq('status', 'Active').order('name')

  const grandTotal = rows.reduce((s, r) => s + (parseFloat(r.total_payment ?? '0') || 0), 0)

  const inp: CSSProperties = {
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: '140px',
  }
  const lbl: CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/reports" style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}>
          ← Laporan
        </Link>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Laporan pembayaran</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Hanya expense berstatus Dibayar; diurut dan difilter menurut tanggal bayar (bukan tanggal transaksi atau due date).
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '14px 16px',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={lbl}>Dari tanggal bayar</label>
          <input type="date" name="from" defaultValue={from} style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>Sampai tanggal bayar</label>
          <input type="date" name="to" defaultValue={to} style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>Business unit</label>
          <select name="bu" defaultValue={bu} style={{ ...inp, width: '100%' }}>
            <option value="">Semua</option>
            <option value="RKT">RKT</option>
            <option value="SPH">SPH</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Tipe</label>
          <select name="type" defaultValue={type} style={{ ...inp, width: '100%' }}>
            <option value="">Semua</option>
            <option value="PO">PO</option>
            <option value="Reimburse">Reimburse</option>
            <option value="Salary">Salary</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Metode pembayaran</label>
          <select name="pm" defaultValue={paymentMethodNone ? '__none__' : paymentMethod} style={{ ...inp, width: '100%' }}>
            <option value="">Semua</option>
            <option value="__none__">Belum diisi</option>
            {PAYMENT_METHODS.map(method => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Proyek</label>
          <select name="project_id" defaultValue={projectNone ? '__none__' : projectId} style={{ ...inp, width: '100%' }}>
            <option value="">Semua</option>
            <option value="__none__">Non-proyek</option>
            {(projects ?? []).map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
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
            Terapkan filter
          </button>
        </div>
      </form>

      <div
        style={{
          background: '#F0FDF4',
          border: '1px solid #86EFAC',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px 24px',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total dibayar</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#14532D', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(grandTotal)}</div>
        </div>
        <div style={{ fontSize: '13px', color: '#15803D' }}>
          {rows.length} transaksi (halaman ini) · tanggal bayar {from} s/d {to}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          Tidak ada pembayaran untuk filter ini.
        </div>
      ) : (
        <PaymentsReportTable rows={rows} loadMoreHref={loadMoreHref} />
      )}
    </div>
  )
}
