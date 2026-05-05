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

export type PaymentsReportRow = {
  id: string
  ref_no: string | null
  payment_date: string | null
  transaction_date: string
  type: string
  total_payment: string | null
  description: string | null
  business_unit: string | null
  payment_method: string | null
  project_id: string | null
  project: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

export function PaymentsReportTable({ rows }: { rows: PaymentsReportRow[] }) {
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })
  const toggleSort = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  const sorted = useMemo(() => {
    const key = tableSort.key
    if (!key) return rows
    const dir = tableSort.dir
    const copy = [...rows]
    copy.sort((a, b) => {
      switch (key) {
        case 'payment_date':
          return compareText(a.payment_date, b.payment_date, dir)
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
        case 'category':
          return compareText(a.category?.name, b.category?.name, dir)
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
  }, [rows, tableSort])

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <SortableTh
                label="Tanggal bayar"
                columnKey="payment_date"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Tanggal transaksi"
                columnKey="transaction_date"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Ref"
                columnKey="ref_no"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Deskripsi"
                columnKey="description"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Tipe"
                columnKey="type"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="BU"
                columnKey="business_unit"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Metode pembayaran"
                columnKey="payment_method"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Proyek"
                columnKey="project"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Kategori"
                columnKey="category"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="text"
              />
              <SortableTh
                label="Total"
                columnKey="total"
                activeKey={tableSort.key}
                direction={tableSort.dir}
                onToggle={toggleSort}
                kind="number"
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < sorted.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{e.payment_date}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748B' }}>{e.transaction_date}</td>
                <td style={{ padding: '10px 14px' }}>
                  <Link href={`/expenses/${e.id}`} style={{ color: '#2563EB', textDecoration: 'none' }}>
                    {e.ref_no ?? e.id.slice(0, 8)}
                  </Link>
                </td>
                <td style={{ padding: '10px 14px', maxWidth: '200px', color: '#334155' }}>{e.description ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>{e.type}</td>
                <td style={{ padding: '10px 14px' }}>{e.business_unit ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>{e.payment_method ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>{e.project?.name ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>{e.category?.name ?? '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatIDR(e.total_payment)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
