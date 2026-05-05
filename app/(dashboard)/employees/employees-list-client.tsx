'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { useCrudTableSort } from '@/lib/crud-table-sort'
import { formatIDR } from '@/lib/decimal'
import { summarizeCompensationRows } from '@/lib/compensation-summary'
import { compareNum, compareText } from '@/lib/table-sort'

export interface EmployeeListRow {
  id: string
  nip: string | null
  full_name: string
  job_title: string | null
  status: string
  gross_salary: number
  total_deduction: number
  net_salary: number
}

export function EmployeesListClient({ initialRows, myRole }: { initialRows: EmployeeListRow[]; myRole: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<EmployeeListRow[]>(initialRows)
  const [q, setQ] = useState('')
  const { tableSort, sortProp } = useCrudTableSort()

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  async function reload() {
    const { data: emps } = await supabase
      .from('employees')
      .select('id, full_name, nip, job_title, status')
      .order('full_name')
    const { data: compRows } = await supabase
      .from('employee_salary_component_amounts')
      .select('employee_id, amount, salary_component_templates(kind, include_in_monthly_payroll)')
    const byEmp = new Map<string, { kind: string; amount: string | number; include_in_monthly_payroll?: boolean }[]>()
    for (const c of compRows ?? []) {
      const t = c.salary_component_templates as
        | { kind?: string; include_in_monthly_payroll?: boolean }
        | { kind?: string; include_in_monthly_payroll?: boolean }[]
        | null
      const tmpl = Array.isArray(t) ? t[0] : t
      const kind = tmpl?.kind ?? 'earning'
      const include_in_monthly_payroll = tmpl?.include_in_monthly_payroll !== false
      const list = byEmp.get(c.employee_id) ?? []
      list.push({ kind, amount: c.amount, include_in_monthly_payroll })
      byEmp.set(c.employee_id, list)
    }
    const next: EmployeeListRow[] = (emps ?? []).map(e => {
      const s = summarizeCompensationRows(byEmp.get(e.id) ?? [])
      return {
        id: e.id,
        nip: e.nip,
        full_name: e.full_name,
        job_title: e.job_title,
        status: e.status,
        gross_salary: s.gross,
        total_deduction: s.deductions,
        net_salary: s.net,
      }
    })
    setRows(next)
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      r =>
        (r.nip && r.nip.toLowerCase().includes(s)) ||
        r.full_name.toLowerCase().includes(s) ||
        (r.job_title && r.job_title.toLowerCase().includes(s))
    )
  }, [rows, q])

  const sortedFiltered = useMemo(() => {
    const sortColumn = tableSort.key
    if (!sortColumn) return filtered
    const dir = tableSort.dir
    const copy = [...filtered]
    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'nip':
          return compareText(a.nip, b.nip, dir)
        case 'full_name':
          return compareText(a.full_name, b.full_name, dir)
        case 'job_title':
          return compareText(a.job_title, b.job_title, dir)
        case 'status':
          return compareText(a.status, b.status, dir)
        case 'net_salary':
          return compareNum(a.net_salary, b.net_salary, dir)
        case 'total_deduction':
          return compareNum(a.total_deduction, b.total_deduction, dir)
        case 'gross_salary':
          return compareNum(a.gross_salary, b.gross_salary, dir)
        default:
          return 0
      }
    })
    return copy
  }, [filtered, tableSort])

  async function onSave(values: Record<string, string>) {
    const payload = {
      full_name: values.full_name,
      job_title: values.job_title?.trim() || null,
      status: values.status || 'Active',
    }
    const { error } = values.id
      ? await supabase.from('employees').update(payload).eq('id', values.id)
      : await supabase.from('employees').insert({
          ...payload,
          role: 'staff',
          email: null,
          salary_amount: 0,
          is_permanent: false,
        })
    if (!error) await reload()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const row = rows.find(r => r.id === id)
    if (row?.status === 'Active') {
      return { error: 'Nonaktifkan karyawan (status Inactive) terlebih dahulu sebelum menghapus.' }
    }
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (!error) await reload()
    return { error: error?.message }
  }

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', maxWidth: '720px' }}>
        NIP diisi otomatis. Akun login (email & role) diatur di <strong>Pengaturan → User</strong>. Pastikan migrasi SQL
        HR sudah dijalankan di Supabase agar kontrak & komponen gaji tersedia.
      </p>
      <div style={{ marginBottom: '16px', maxWidth: '360px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
          Cari (NIP, nama, jabatan)
        </label>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ketik untuk menyaring…"
          style={{
            width: '100%',
            padding: '9px 12px',
            fontSize: '13px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            outline: 'none',
          }}
        />
      </div>
      <CrudTable
        title="karyawan"
        data={sortedFiltered}
        showDelete={myRole === 'owner'}
        deleteDisabled={row => row.status === 'Active'}
        sort={sortProp}
        fields={[
          { key: 'nip', label: 'NIP', readOnly: true },
          { key: 'full_name', label: 'Nama lengkap', required: true, placeholder: 'Budi Santoso' },
          { key: 'job_title', label: 'Jabatan', placeholder: 'Software Engineer' },
          { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
        ]}
        displayCols={[
          { key: 'nip', label: 'NIP', sortable: 'text' },
          { key: 'full_name', label: 'Nama', sortable: 'text' },
          { key: 'job_title', label: 'Jabatan', sortable: 'text', render: r => r.job_title ?? '—' },
          {
            key: 'net_salary',
            label: 'Net salary',
            sortable: 'number',
            render: r => formatIDR(r.net_salary.toFixed(2)),
          },
          {
            key: 'total_deduction',
            label: 'Potongan',
            sortable: 'number',
            render: r => formatIDR(r.total_deduction.toFixed(2)),
          },
          {
            key: 'gross_salary',
            label: 'Bruto (gaji kotor)',
            sortable: 'number',
            render: r => formatIDR(r.gross_salary.toFixed(2)),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: 'text',
            render: r => (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  background: r.status === 'Active' ? '#F0FDF4' : '#F8FAFC',
                  color: r.status === 'Active' ? '#166534' : '#64748B',
                }}
              >
                {r.status}
              </span>
            ),
          },
          {
            key: '_detail',
            label: '',
            render: r => (
              <Link href={`/employees/${r.id}`} style={{ fontSize: '12px', fontWeight: '500', color: '#2563EB', textDecoration: 'none' }}>
                Detail HR →
              </Link>
            ),
          },
        ]}
        onSave={onSave}
        onDelete={onDelete}
        emptyText={q.trim() ? 'Tidak ada karyawan yang cocok dengan pencarian.' : 'Belum ada data karyawan.'}
      />
    </div>
  )
}
