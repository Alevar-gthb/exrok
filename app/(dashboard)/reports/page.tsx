// app/(dashboard)/reports/page.tsx
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExportButton } from '@/components/export-button'

export const metadata = { title: 'Laporan | Exrok' }

const reportCard = {
  background: '#fff' as const,
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  padding: '18px 20px',
  textDecoration: 'none' as const,
  color: 'inherit' as const,
  display: 'block' as const,
  transition: 'border-color .15s, box-shadow .15s',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!me || !['owner', 'finance'].includes(me.role)) redirect('/expenses')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('total_payment, status, type, transaction_date')

  const approved = expenses?.filter(e => e.status === 'Approved') ?? []
  const pending  = expenses?.filter(e => e.status === 'Pending Approval') ?? []
  const totalApproved = approved.reduce((sum, e) => sum + parseFloat(e.total_payment ?? '0'), 0)
  const totalPending  = pending.reduce((sum, e)  => sum + parseFloat(e.total_payment ?? '0'), 0)

  const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  const stats = [
    { label: 'Total Disetujui', value: fmt(totalApproved), sub: `${approved.length} transaksi`, color: '#166534', bg: '#F0FDF4', border: '#86EFAC' },
    { label: 'Menunggu Approval', value: fmt(totalPending), sub: `${pending.length} transaksi`, color: '#92400E', bg: '#FFFBEB', border: '#FCD34D' },
    { label: 'Total Semua', value: fmt(totalApproved + totalPending), sub: `${expenses?.length ?? 0} transaksi`, color: '#1E3A5F', bg: '#EFF6FF', border: '#BFDBFE' },
  ]

  const links = [
    {
      href: '/reports/expenses',
      title: 'Laporan pengeluaran',
      desc: 'Per kategori & subkategori berdasarkan tanggal transaksi; filter status, BU, tipe, metode bayar, proyek.',
      accent: '#1D4ED8',
      bg: '#EFF6FF',
    },
    {
      href: '/reports/reimburse',
      title: 'Laporan reimburse',
      desc: 'Ringkasan batch reimburse seperti sebelumnya.',
      accent: '#166534',
      bg: '#F0FDF4',
    },
    {
      href: '/reports/payroll',
      title: 'Laporan gaji',
      desc: 'Payroll per bulan: karyawan, bruto, pemotongan, nett.',
      accent: '#A16207',
      bg: '#FFFBEB',
    },
    {
      href: '/reports/payments',
      title: 'Laporan pembayaran',
      desc: 'Expense dibayar menurut tanggal bayar; filter rentang, BU, tipe, metode bayar, proyek.',
      accent: '#0F766E',
      bg: '#F0FDFA',
    },
  ]

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Laporan</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Ringkasan keuangan, submenu laporan, dan export data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px', padding: '16px 20px' }}>
            <p style={{ fontSize: '12px', color: s.color, margin: '0 0 6px', fontWeight: '500', opacity: 0.8 }}>{s.label}</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: s.color, margin: '0 0 2px', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: s.color, margin: 0, opacity: 0.7 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', margin: '0 0 12px' }}>Submenu laporan</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {links.map(L => (
          <Link
            key={L.href}
            href={L.href}
            style={{
              ...reportCard,
              borderLeft: `4px solid ${L.accent}`,
              background: L.bg,
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '6px' }}>{L.title}</div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: 1.45 }}>{L.desc}</p>
          </Link>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Export Laporan Excel</h2>
        <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px' }}>Download data expense dalam format .xlsx (filter tanggal transaksi di API)</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }}>Dari Tanggal</label>
            <input type="date" style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' }}>Sampai Tanggal</label>
            <input type="date" style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        <ExportButton />
      </div>
    </div>
  )
}
