import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { SalaryComponentsSettingsClient } from './salary-components-settings-client'

export const metadata = { title: 'Master komponen gaji | Exrok' }

export default async function SalaryComponentsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
    redirect('/expenses')
  }

  const { data: templates } = await supabase
    .from('salary_component_templates')
    .select('id, code, label, kind, is_active, include_in_monthly_payroll, excel_aliases')
    .order('code')

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>Master komponen gaji</h1>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', maxWidth: '640px' }}>
        Definisi sekali di sini, lalu di detail karyawan cukup pilih komponen dan isi nominal. Hapus master hanya untuk
        owner; komponen yang sudah dipakai karyawan tidak bisa dihapus sampai nominal dihapus dulu.
      </p>
      <SalaryComponentsSettingsClient initialRows={templates ?? []} myRole={me.role} />
    </div>
  )
}
