'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'

type UserRow = {
  id: string
  full_name: string
  email: string | null
  role: string
  status: string
  created_at?: string
}

export function UsersSettingsClient({ initialRows }: { initialRows: UserRow[] }) {
  const supabase = createClient()
  const [data, setData] = useState<UserRow[]>(initialRows)

  async function load() {
    const { data: d } = await supabase
      .from('employees')
      .select('id, full_name, email, role, status, created_at')
      .order('full_name')
    setData((d as UserRow[]) ?? [])
  }

  useEffect(() => {
    setData(initialRows)
  }, [initialRows])

  async function onSave(values: Record<string, string>) {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      role: values.role || 'staff',
      status: values.status || 'Active',
    }
    const { error } = values.id
      ? await supabase.from('employees').update(payload).eq('id', values.id)
      : await supabase.from('employees').insert({
          ...payload,
          salary_amount: 0,
          nip: null,
          job_title: null,
          is_permanent: false,
        })
    if (!error) load()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
    owner: { bg: '#FDF4FF', color: '#7E22CE' },
    finance: { bg: '#EFF6FF', color: '#1D4ED8' },
    ga: { bg: '#ECFDF5', color: '#065F46' },
    staff: { bg: '#F8FAFC', color: '#475569' },
  }

  return (
    <CrudTable
      title="User & role"
      data={data}
      fields={[
        { key: 'full_name', label: 'Nama Lengkap', required: true, placeholder: 'Budi Santoso' },
        { key: 'email', label: 'Email', placeholder: 'budi@roketin.com' },
        { key: 'role', label: 'Role', type: 'select', options: ['owner', 'finance', 'ga', 'staff'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      ]}
      displayCols={[
        { key: 'full_name', label: 'Nama' },
        { key: 'email', label: 'Email' },
        {
          key: 'role',
          label: 'Role',
          render: row => {
            const s = ROLE_COLOR[row.role] ?? ROLE_COLOR.staff
            return (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '500',
                  background: s.bg,
                  color: s.color,
                }}
              >
                {row.role}
              </span>
            )
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: row => (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '20px',
                fontSize: '11px',
                background: row.status === 'Active' ? '#F0FDF4' : '#F8FAFC',
                color: row.status === 'Active' ? '#166534' : '#64748B',
              }}
            >
              {row.status}
            </span>
          ),
        },
      ]}
      onSave={onSave}
      onDelete={onDelete}
    />
  )
}
