// app/(dashboard)/settings/layout.tsx
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/settings/projects',    label: 'Proyek' },
  { href: '/settings/categories',  label: 'Kategori' },
  { href: '/settings/vendors',     label: 'Vendor' },
  { href: '/settings/employees',   label: 'Karyawan' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (!me || me.role !== 'owner') redirect('/expenses')

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 20px' }}>Pengaturan</h1>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '0' }}>
        {TABS.map(t => (
          <Link key={t.href} href={t.href} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '500', color: '#64748B', textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-1px' }}
            className="settings-tab">
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
