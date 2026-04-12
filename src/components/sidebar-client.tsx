'use client'

// ============================================================
// src/components/sidebar-client.tsx
// Sidebar navigasi Exrok — client component (hover states, logout, submenu)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import type { UserRole } from '@/types/database.types'

interface SubItem {
  href: string
  label: string
  roles: UserRole[]
}

interface NavItem {
  id: string
  href: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
  children?: SubItem[]
}

const NAV: NavItem[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['owner', 'finance', 'ga', 'staff'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'expense',
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
    children: [
      { href: '/expenses', label: 'Expense List', roles: ['owner', 'finance', 'ga'] },
      { href: '/expenses/categories', label: 'Expense Categories', roles: ['owner', 'finance', 'ga'] },
    ],
  },
  {
    id: 'inventory',
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
    id: 'employees',
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
    id: 'payroll',
    href: '/payroll',
    label: 'Payroll',
    roles: ['owner', 'finance'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3h10v10H3V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M6 6h4M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'reports',
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
    id: 'settings',
    href: '/settings/vendors',
    label: 'Pengaturan',
    roles: ['owner', 'finance', 'ga'],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    children: [
      { href: '/settings/vendors', label: 'Vendor', roles: ['owner', 'finance', 'ga'] },
      { href: '/settings/projects', label: 'Project List', roles: ['owner'] },
      { href: '/settings/salary-components', label: 'Komponen gaji', roles: ['owner', 'finance'] },
      { href: '/settings/approval-rules', label: 'Approval Rules', roles: ['owner', 'finance', 'ga', 'staff'] },
      { href: '/settings/users', label: 'User', roles: ['owner'] },
    ],
  },
]

interface SidebarClientProps {
  userName: string
  userRole: string
  employeeId: string
}

export function SidebarClient({ userName, userRole, employeeId }: SidebarClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [approvalBadge, setApprovalBadge] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const fetchApprovalCount = useCallback(async () => {
    const { count } = await supabase
      .from('expense_approvals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending')
      .eq('approver_employee_id', employeeId)
    setApprovalBadge(count ?? 0)
  }, [supabase, employeeId])

  useEffect(() => {
    void fetchApprovalCount()
    const t = setInterval(() => void fetchApprovalCount(), 60_000)
    return () => clearInterval(t)
  }, [fetchApprovalCount])

  // Track which parent menus are open
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    NAV.forEach(item => {
      const visibleChildren = (item.children ?? []).filter(c =>
        c.roles.includes(userRole as UserRole)
      )
      if (visibleChildren.length > 0) {
        const childActive = visibleChildren.some(c => pathname.startsWith(c.href))
        if (childActive) initial[item.id] = true
      }
    })
    return initial
  })

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

  function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    // Biar cookie sesi terhapus dengan benar, lakukan logout lewat route server.
    // (Kalau kita hanya signOut dari client, kadang middleware masih sempat membaca session lama.)
    try {
      window.location.href = '/api/logout'
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[logout] navigation failed:', e)
      void supabase.auth.signOut().finally(() => {
        router.replace('/login')
        setIsLoggingOut(false)
      })
    }
  }

  function toggleMenu(key: string) {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function navItemStyle(active: boolean): React.CSSProperties {
    return {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
      fontSize: '13px', fontWeight: active ? '500' : '400',
      color: active ? '#F1F5F9' : '#94A3B8',
      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      textDecoration: 'none', transition: 'all .15s', cursor: 'pointer',
      width: '100%', border: 'none', textAlign: 'left',
    }
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
          const visibleChildren = (item.children ?? []).filter(c =>
            c.roles.includes(userRole as UserRole)
          )
          const hasChildren = visibleChildren.length > 0
          const isOpen = openMenus[item.id] ?? false
          const active = !hasChildren && pathname === item.href
          const parentActive = hasChildren
            ? (visibleChildren.some(c => pathname.startsWith(c.href)) || pathname === item.href)
            : false

          return (
            <div key={item.id}>
              {/* Parent item */}
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => {
                    toggleMenu(item.id)
                  }}
                  style={{
                    ...navItemStyle(parentActive),
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => {
                    if (!parentActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                      ;(e.currentTarget as HTMLElement).style.color = '#CBD5E1'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!parentActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ opacity: parentActive ? 1 : 0.7 }}>{item.icon}</span>
                    {item.label}
                  </span>
                  {/* Chevron */}
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    style={{ transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
                  >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                <a
                  href={item.href}
                  style={navItemStyle(active)}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {item.label}
                    {item.id === 'dashboard' && approvalBadge != null && approvalBadge > 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          minWidth: '18px',
                          height: '18px',
                          padding: '0 5px',
                          borderRadius: '9px',
                          background: '#B45309',
                          color: '#FFFBEB',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {approvalBadge > 99 ? '99+' : approvalBadge}
                      </span>
                    )}
                  </span>
                </a>
              )}

              {/* Submenu */}
              {hasChildren && isOpen && (
                <div style={{ marginBottom: '4px' }}>
                  {/* Child links */}
                  {visibleChildren.map(child => {
                      const childActive = pathname.startsWith(child.href)
                      return (
                        <a
                          key={child.href}
                          href={child.href}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 10px 6px 36px', borderRadius: '6px',
                            fontSize: '12px',
                            color: childActive ? '#F1F5F9' : '#64748B',
                            background: childActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                            textDecoration: 'none', transition: 'all .15s',
                          }}
                          onMouseEnter={e => {
                            if (!childActive) {
                              (e.currentTarget as HTMLElement).style.color = '#94A3B8'
                              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!childActive) {
                              (e.currentTarget as HTMLElement).style.color = '#64748B'
                              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                            }
                          }}
                        >
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}/>
                          {child.label}
                        </a>
                      )
                    })}
                </div>
              )}
            </div>
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
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', borderRadius: '8px', fontSize: '12px',
            color: '#64748B', background: 'none', border: 'none',
            cursor: isLoggingOut ? 'not-allowed' : 'pointer', transition: 'all .15s', textAlign: 'left',
            opacity: isLoggingOut ? 0.7 : 1,
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
          {isLoggingOut ? 'Keluar...' : 'Keluar'}
        </button>
      </div>
    </aside>
  )
}
