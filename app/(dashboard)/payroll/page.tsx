import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { PayrollCreateRunForm } from './payroll-create-run-form'
import type { PayrollRun } from '@/types/database.types'

export const metadata = { title: 'Payroll | Exrok' }

export default async function PayrollPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!me || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  const { data: runs } = await supabase.from('payroll_runs').select('*').order('created_at', { ascending: false })

  const list = (runs as PayrollRun[]) ?? []

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>Payroll</h1>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', maxWidth: '640px' }}>
        Generate payroll per periode dari komponen gaji karyawan, sesuaikan proyek dan penyesuaian, lalu catatkan ke expense
        Salary per karyawan dan kirim ke alur approval.
      </p>
      <PayrollCreateRunForm />
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Periode</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: '600', color: '#475569' }}></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '24px 16px', color: '#94A3B8', textAlign: 'center' }}>
                  Belum ada payroll. Buat dengan form di atas.
                </td>
              </tr>
            ) : (
              list.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '500', color: '#0F172A' }}>
                    {String(r.period_month).padStart(2, '0')}/{r.period_year}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        background: r.status === 'draft' ? '#FEF9C3' : '#F0FDF4',
                        color: r.status === 'draft' ? '#854D0E' : '#166534',
                      }}
                    >
                      {r.status === 'draft' ? 'Draft' : 'Disubmit'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <Link href={`/payroll/${r.id}`} style={{ fontSize: '12px', fontWeight: '500', color: '#2563EB', textDecoration: 'none' }}>
                      Buka →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
