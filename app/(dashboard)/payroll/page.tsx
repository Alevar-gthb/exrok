import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { PayrollCreateRunForm } from './payroll-create-run-form'
import { PayrollImportForm } from './payroll-import-form'
import { PayrollRunsTable } from '@/components/payroll-runs-table'
import type { PayrollRun } from '@/types/database.types'

export const metadata = { title: 'Payroll | Exrok' }

export default async function PayrollPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
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
      <PayrollImportForm />
      <PayrollRunsTable runs={list} />
    </div>
  )
}
