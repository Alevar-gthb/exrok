'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatIDR } from '@/lib/decimal'
import type { PayrollRunLine } from '@/types/database.types'
import { SortableTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import { compareNum, compareText, cycleColumnSort } from '@/lib/table-sort'

export type PayrollReportLine = PayrollRunLine & { employee?: { full_name: string } | null }

export type PayrollReportDetailRow = {
  line: PayrollReportLine
  gross: number
  deductions: number
  nett: number
}

export function PayrollReportLinesTable({ detail }: { detail: PayrollReportDetailRow[] }) {
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })
  const toggle = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  const sorted = useMemo(() => {
    const key = tableSort.key
    if (!key) return detail
    const dir = tableSort.dir
    const copy = [...detail]
    copy.sort((a, b) => {
      const la = a.line
      const lb = b.line
      switch (key) {
        case 'employee':
          return compareText(la.employee?.full_name, lb.employee?.full_name, dir)
        case 'gross':
          return compareNum(a.gross, b.gross, dir)
        case 'deductions':
          return compareNum(a.deductions, b.deductions, dir)
        case 'nett':
          return compareNum(a.nett, b.nett, dir)
        case 'expense':
          return compareText(la.expense_id ?? '', lb.expense_id ?? '', dir)
        default:
          return 0
      }
    })
    return copy
  }, [detail, tableSort])

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
            <SortableTh
              label="Karyawan"
              columnKey="employee"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
            />
            <SortableTh
              label="Bruto"
              columnKey="gross"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="number"
              align="right"
            />
            <SortableTh
              label="Pemotongan"
              columnKey="deductions"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="number"
              align="right"
            />
            <SortableTh
              label="Nett"
              columnKey="nett"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="number"
              align="right"
            />
            <SortableTh
              label="Expense"
              columnKey="expense"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ line: l, gross, deductions, nett }) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '12px 16px', fontWeight: '500', color: '#0F172A' }}>{l.employee?.full_name ?? '—'}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(gross)}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(deductions)}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }}>
                {formatIDR(nett)}
              </td>
              <td style={{ padding: '12px 16px' }}>
                {l.expense_id ? (
                  <Link href={`/expenses/${l.expense_id}`} style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none' }}>
                    Expense
                  </Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
