'use client'

import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { useCrudTableSort } from '@/lib/crud-table-sort'
import { compareText } from '@/lib/table-sort'

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
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSaving, setResetSaving] = useState(false)
  const { tableSort, sortProp } = useCrudTableSort()

  const sortedData = useMemo(() => {
    const key = tableSort.key
    if (!key) return data
    const dir = tableSort.dir
    const copy = [...data]
    copy.sort((a, b) => {
      switch (key) {
        case 'full_name':
          return compareText(a.full_name, b.full_name, dir)
        case 'email':
          return compareText(a.email, b.email, dir)
        case 'role':
          return compareText(a.role, b.role, dir)
        case 'status':
          return compareText(a.status, b.status, dir)
        default:
          return 0
      }
    })
    return copy
  }, [data, tableSort])

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
    if (!values.id) {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: values.full_name,
          email: values.email,
          role: values.role || 'staff',
          status: values.status || 'Active',
          password: values.password,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        return { error: json.error ?? 'Gagal membuat user baru.' }
      }
      await load()
      return {}
    }

    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      role: values.role || 'staff',
      status: values.status || 'Active',
    }
    const { error } = await supabase.from('employees').update(payload).eq('id', values.id)
    if (!error) load()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const row = data.find(r => r.id === id)
    if (row?.status === 'Active') {
      return { error: 'Nonaktifkan karyawan (status Inactive) terlebih dahulu sebelum menghapus.' }
    }
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  async function onSubmitResetPassword() {
    if (!resetTarget) return
    setResetSaving(true)
    setResetError(null)
    const response = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })
    const json = (await response.json().catch(() => ({}))) as { error?: string }
    setResetSaving(false)
    if (!response.ok) {
      setResetError(json.error ?? 'Gagal reset password user.')
      return
    }
    setResetTarget(null)
    setNewPassword('')
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
      data={sortedData}
      sort={sortProp}
      deleteDisabled={row => row.status === 'Active'}
      fields={[
        { key: 'full_name', label: 'Nama Lengkap', required: true, placeholder: 'Budi Santoso' },
        { key: 'email', label: 'Email', placeholder: 'budi@roketin.com' },
        { key: 'role', label: 'Role', type: 'select', options: ['owner', 'finance', 'ga', 'staff'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
        {
          key: 'password',
          label: 'Password (saat create)',
          type: 'password',
          placeholder: 'Min. 8 karakter, huruf besar-kecil + angka',
        },
      ]}
      displayCols={[
        { key: 'full_name', label: 'Nama', sortable: 'text' },
        { key: 'email', label: 'Email', sortable: 'text' },
        {
          key: 'role',
          label: 'Role',
          sortable: 'text',
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
          sortable: 'text',
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
        {
          key: 'password_action',
          label: 'Password',
          render: row => (
            <button
              type="button"
              onClick={() => {
                setResetTarget(row)
                setNewPassword('')
                setResetError(null)
              }}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#1D4ED8',
              }}
            >
              Reset
            </button>
          ),
        },
      ]}
      onSave={onSave}
      onDelete={onDelete}
    >
      {resetTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '18px',
            }}
          >
            <h3 style={{ margin: 0, marginBottom: '8px', fontSize: '14px', color: '#0F172A' }}>
              Reset Password
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748B' }}>
              User: <strong>{resetTarget.full_name}</strong> ({resetTarget.email ?? 'tanpa email'})
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Password baru"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                marginBottom: '10px',
              }}
            />
            {resetError && <p style={{ fontSize: '12px', color: '#DC2626', margin: '0 0 10px' }}>{resetError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onSubmitResetPassword}
                disabled={resetSaving}
                style={{
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: resetSaving ? '#94A3B8' : '#0F172A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: resetSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {resetSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CrudTable>
  )
}
