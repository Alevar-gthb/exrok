'use client'

// ============================================================
// src/components/sidebar-client.tsx
// Sidebar navigasi Exrok — client component (hover states, logout)
// ============================================================

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import type { UserRole } from '@/types/database.types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: UserRole[] // siapa yang boleh lihat item ini
}

const NAV: NavItem[] = [
  {
    href: '/expenses',
    label: 'Expense',
    roles: ['owner', 'finance', 'ga', 'staff'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 10h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/inventory',
    label: 'Inventaris',
    roles: ['owner', 'finance', 'ga'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4l6-2 6 2v8l-6 2-6-2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 2v12M2 4l6 2 6-2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/employees',
    label: 'Karyawan',
    roles: ['owner', 'finance'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Laporan',
    roles: ['owner', 'finance'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings/projects',
    label: 'Pengaturan',
    roles: ['owner'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

interface SidebarClientProps {
  userName: string
  userRole: string
}

export function SidebarClient({ userName, userRole }: SidebarClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const visibleNav = NAV.filter(item =>
    item.roles.includes(userRole as UserRole)
  )

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const roleLabel: Record<string, string> = {
    owner: 'Owner', finance: 'Finance',
    ga: 'General Affairs', staff: 'Staff',
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: '220px', background: '#0F172A',
      display: 'flex', flexDirection: 'column',
      padding: '0', zIndex: 50, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <path d="M4 17L11 4L18 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 13h9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>Exrok</div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>Ops System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: '500', color: '#475569', letterSpacing: '.06em', textTransform: 'uppercase', padding: '0 8px', marginBottom: '6px' }}>
          Menu
        </div>
        {visibleNav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                fontSize: '13px', fontWeight: active ? '500' : '400',
                color: active ? '#F1F5F9' : '#94A3B8',
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration: 'none', transition: 'all .15s',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                  ;(e.currentTarget as HTMLElement).style.color = '#CBD5E1'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
                }
              }}
            >
              <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* User profile + logout */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: '#1E40AF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '11px', fontWeight: '600',
            color: '#BFDBFE', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>
              {roleLabel[userRole] ?? userRole}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', borderRadius: '8px', fontSize: '12px',
            color: '#64748B', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            ;(e.currentTarget as HTMLElement).style.color = '#F87171'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#64748B'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M6 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Keluar
        </button>
      </div>
    </aside>
  )
}
