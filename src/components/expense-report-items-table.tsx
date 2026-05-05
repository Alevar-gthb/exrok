'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatIDR } from '@/lib/decimal'
import { SortableTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import {
  compareNum,
  compareText,
  cycleColumnSort,
  parseDecimalString,
} from '@/lib/table-sort'

export type ExpenseReportItemRow = {
  id: string
  ref_no: string | null
  transaction_date: string
  type: string
  status: string
  total_payment: string | null
  description: string | null
  business_unit: string | null
  payment_method: string | null
  project_id: string | null
  project: { id: string; name: string } | null
  category: { id: string; name: string } | null
  subcategory: { id: string; name: string } | null
}

export function ExpenseReportItemsTable({ items, loadMoreHref = null }: { items: ExpenseReportItemRow[]; loadMoreHref?: string | null }) {
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })
  const toggle = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  const sorted = useMemo(() => {
    const key = tableSort.key
    if (!key) return items
    const dir = tableSort.dir
    const copy = [...items]
    copy.sort((a, b) => {
      switch (key) {
        case 'transaction_date':
          return compareText(a.transaction_date, b.transaction_date, dir)
        case 'ref_no':
          return compareText(a.ref_no, b.ref_no, dir)
        case 'description':
          return compareText(a.description, b.description, dir)
        case 'type':
          return compareText(a.type, b.type, dir)
        case 'business_unit':
          return compareText(a.business_unit, b.business_unit, dir)
        case 'payment_method':
          return compareText(a.payment_method, b.payment_method, dir)
        case 'project':
          return compareText(a.project?.name, b.project?.name, dir)
        case 'status':
          return compareText(a.status, b.status, dir)
        case 'total':
          return compareNum(
            parseDecimalString(a.total_payment),
            parseDecimalString(b.total_payment),
            dir,
          )
        default:
          return 0
      }
    })
    return copy
  }, [items, tableSort])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ color: '#64748B' }}>
            <SortableTh
              label="Tanggal transaksi"
              columnKey="transaction_date"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Ref"
              columnKey="ref_no"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Deskripsi"
              columnKey="description"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Tipe"
              columnKey="type"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="BU"
              columnKey="business_unit"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Metode pembayaran"
              columnKey="payment_method"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Proyek"
              columnKey="project"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Status"
              columnKey="status"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="text"
              compact
            />
            <SortableTh
              label="Total"
              columnKey="total"
              activeKey={tableSort.key}
              direction={tableSort.dir}
              onToggle={toggle}
              kind="number"
              align="right"
              compact
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.id} style={{ borderTop: '1px solid #F1F5F9' }}>
              <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>{e.transaction_date}</td>
              <td style={{ padding: '8px 14px' }}>
                <Link href={`/expenses/${e.id}`} style={{ color: '#2563EB', textDecoration: 'none' }}>
                  {e.ref_no ?? e.id.slice(0, 8)}
                </Link>
              </td>
              <td style={{ padding: '8px 14px', maxWidth: '220px', color: '#334155' }}>{e.description ?? '—'}</td>
              <td style={{ padding: '8px 14px' }}>{e.type}</td>
              <td style={{ padding: '8px 14px' }}>{e.business_unit ?? '—'}</td>
              <td style={{ padding: '8px 14px' }}>{e.payment_method ?? '—'}</td>
              <td style={{ padding: '8px 14px' }}>{e.project?.name ?? '—'}</td>
              <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>{e.status}</td>
              <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatIDR(e.total_payment)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loadMoreHref && (
        <div style={{ padding: '10px', textAlign: 'center' }}>
          <a href={loadMoreHref} style={{ fontSize: '12px', color: '#334155', textDecoration: 'none' }}>
            Muat transaksi berikutnya
          </a>
        </div>
      )}
    </div>
  )
}
