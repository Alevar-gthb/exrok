// app/(dashboard)/layout.tsx
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarClient } from '@/components/sidebar-client'
import { parseEmployeeRecord } from '@/lib/employee-session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empJson } = await supabase.rpc('get_my_employee_record')
  const me = parseEmployeeRecord(empJson)

  if (!me) redirect('/login')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Sidebar */}
      <SidebarClient
        userName={me.full_name ?? user.email ?? 'User'}
        userRole={me.role ?? 'staff'}
        employeeId={me.id}
      />

      {/* Main Content */}
      <main style={{
        marginLeft: '220px',
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <div style={{
          height: '56px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>
            Selamat datang, <span style={{ color: '#0F172A', fontWeight: '500' }}>{me.full_name ?? user.email}</span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px', flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
