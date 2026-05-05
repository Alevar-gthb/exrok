'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { PayrollRun } from '@/types/database.types'
import { SortableTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import { compareNum, compareText, cycleColumnSort } from '@/lib/table-sort'

export function PayrollRunsTable({ runs }: { runs: PayrollRun[] }) {
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })
  const toggle = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  const sorted = useMemo(() => {
    const key = tableSort.key
    if (!key) return runs
    const dir = tableSort.dir
    const copy = [...runs]
    copy.sort((a, b) => {
      switch (key) {
        case 'period':
          return compareNum(
            a.period_year * 100 + a.period_month,
            b.period_year * 100 + b.period_month,
            dir,
          )
        case 'status':
          return compareText(a.status, b.status, dir)
        default:
          return 0
      }
    })
    return copy
  }, [runs, tableSort])

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <SortableTh
              label="Periode"
              columnKey="period"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="number"
            />
            <SortableTh
              label="Status"
              columnKey="status"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
            />
            <StaticThActions />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: '24px 16px', color: '#94A3B8', textAlign: 'center' }}>
                Belum ada payroll. Buat dengan form di atas.
              </td>
            </tr>
          ) : (
            sorted.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500', color: '#0F172A' }}>
                  {String(r.period_month).padStart(2, '0')}/{r.period_year}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      background: r.status === 'draft' ? '#FEF9C3' : '#F0FDF4',
                      color: r.status === 'draft' ? '#854D0E' : '#166534',
                    }}
                  >
                    {r.status === 'draft' ? 'Draft' : 'Disubmit'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Link
                    href={`/payroll/${r.id}`}
                    style={{ fontSize: '12px', fontWeight: '500', color: '#2563EB', textDecoration: 'none' }}
                  >
                    Buka →
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function StaticThActions() {
  return (
    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: '600', color: '#475569' }} />
  )
}
