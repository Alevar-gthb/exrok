import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { SecuritySettingsClient } from './security-settings-client'

export default async function SettingsSecurityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
        Kelola keamanan akun Anda dengan mengganti password login secara berkala.
      </p>
      <SecuritySettingsClient email={user.email ?? ''} />
    </div>
  )
}
