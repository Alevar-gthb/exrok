import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { UsersSettingsClient } from './users-settings-client'

export default async function SettingsUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()

  if (me?.role !== 'owner') {
    redirect('/expenses')
  }

  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name, email, role, status, created_at')
    .order('full_name')

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
        Kelola akses aplikasi: nama, email login, role, dan status. Pengaturan gaji dan HR ada di menu{' '}
        <strong>Karyawan</strong>.
      </p>
      <UsersSettingsClient initialRows={employees ?? []} />
    </div>
  )
}
