// app/(dashboard)/reports/expenses/page.tsx
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { formatIDR } from '@/lib/decimal'
import { PAYMENT_METHODS } from '@/lib/validations/expense.schema'
import { ExpenseReportItemsTable } from '@/components/expense-report-items-table'

export const metadata = { title: 'Laporan pengeluaran | Exrok' }

const REPORT_STATUSES = ['Approved', 'Paid', 'Pending Approval'] as const
type ReportStatus = (typeof REPORT_STATUSES)[number]

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

function parseStatuses(raw: string | string[] | undefined): ReportStatus[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').filter(Boolean) : []
  const allow = new Set<string>(REPORT_STATUSES)
  const picked = arr.filter(s => allow.has(s)) as ReportStatus[]
  return picked.length ? picked : [...REPORT_STATUSES]
}

type ExpenseRow = {
  id: string
  ref_no: string | null
  transaction_date: string
  type: string
  status: string
  total_payment: string | null
  description: string | null
  business_unit: string | null
  payment_method: string | null
  project_id: string | null
  project: { id: string; name: string } | null
  category: { id: string; name: string } | null
  subcategory: { id: string; name: string } | null
}

export default async function ExpenseReportPage({
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
  const statuses = parseStatuses(searchParams.st)
  const bu = typeof searchParams.bu === 'string' && ['RKT', 'SPH'].includes(searchParams.bu) ? searchParams.bu : ''
  const type = typeof searchParams.type === 'string' && ['PO', 'Reimburse', 'Salary'].includes(searchParams.type) ? searchParams.type : ''
  const paymentMethodRaw = typeof searchParams.pm === 'string' ? searchParams.pm : ''
  const paymentMethodNone = paymentMethodRaw === '__none__'
  const paymentMethod = !paymentMethodNone && (PAYMENT_METHODS as readonly string[]).includes(paymentMethodRaw) ? paymentMethodRaw : ''
  const projectRaw = typeof searchParams.project_id === 'string' ? searchParams.project_id : ''
  const projectNone = projectRaw === '__none__'
  const projectId = projectRaw && !projectNone && /^[0-9a-f-]{36}$/i.test(projectRaw) ? projectRaw : ''

  let query = supabase
    .from('expenses')
    .select(
      `
      id, ref_no, transaction_date, type, status, total_payment, description, business_unit, payment_method, project_id,
      project:projects(id, name),
      category:expense_categories(id, name),
      subcategory:expense_subcategories(id, name)
    `,
    )
    .in('status', statuses)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: false })

  if (bu) query = query.eq('business_unit', bu as 'RKT' | 'SPH')
  if (type) query = query.eq('type', type as 'PO' | 'Reimburse' | 'Salary')
  if (paymentMethodNone) query = query.is('payment_method', null)
  else if (paymentMethod) query = query.eq('payment_method', paymentMethod)
  if (projectNone) query = query.is('project_id', null)
  else if (projectId) query = query.eq('project_id', projectId)

  const { data: rowsRaw } = await query
  const rows = (rowsRaw ?? []) as unknown as ExpenseRow[]

  const { data: projects } = await supabase.from('projects').select('id, name').eq('status', 'Active').order('name')

  type Group = { sub: string; items: ExpenseRow[]; subTotal: number }
  type CatGroup = { cat: string; subs: Map<string, Group>; catTotal: number }
  const byCat = new Map<string, CatGroup>()

  for (const r of rows) {
    const catName = r.category?.name ?? 'Tanpa kategori'
    const subName = r.subcategory?.name ?? 'Tanpa subkategori'
    const amt = parseFloat(r.total_payment ?? '0') || 0
    let cg = byCat.get(catName)
    if (!cg) {
      cg = { cat: catName, subs: new Map(), catTotal: 0 }
      byCat.set(catName, cg)
    }
    cg.catTotal += amt
    let g = cg.subs.get(subName)
    if (!g) {
      g = { sub: subName, items: [], subTotal: 0 }
      cg.subs.set(subName, g)
    }
    g.items.push(r)
    g.subTotal += amt
  }

  const sortedCats = [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'id'))
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
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Laporan pengeluaran</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Pengeluaran dikelompokkan per kategori dan subkategori berdasarkan tanggal transaksi. Status: disetujui, dibayar, atau menunggu approval.
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
          <label style={lbl}>Dari tanggal transaksi</label>
          <input type="date" name="from" defaultValue={from} style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>Sampai tanggal transaksi</label>
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
          <span style={{ ...lbl, marginBottom: '8px' }}>Status</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 18px' }}>
            {REPORT_STATUSES.map(s => (
              <label key={s} style={{ fontSize: '13px', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="st" value={s} defaultChecked={statuses.includes(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
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
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
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
          <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total (filter)</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(grandTotal)}</div>
        </div>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          {rows.length} transaksi · tanggal transaksi {from} s/d {to}
        </div>
      </div>

      {sortedCats.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          Tidak ada data untuk filter ini.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sortedCats.map(catName => {
            const cg = byCat.get(catName)!
            const subs = [...cg.subs.keys()].sort((a, b) => a.localeCompare(b, 'id'))
            return (
              <div key={catName} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #F1F5F9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>{catName}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(cg.catTotal)}</span>
                </div>
                {subs.map(subName => {
                  const g = cg.subs.get(subName)!
                  return (
                    <div key={subName} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <div
                        style={{
                          padding: '10px 18px',
                          background: '#FAFAFA',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#475569',
                        }}
                      >
                        <span>{subName}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatIDR(g.subTotal)}</span>
                      </div>
                      <ExpenseReportItemsTable items={g.items} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
