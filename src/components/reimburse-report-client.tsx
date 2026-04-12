'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { createReimbursementBatch } from '@/lib/actions/reimbursement.actions'

export type ReimburseReportExpenseRow = {
  id: string
  ref_no: string | null
  transaction_date: string
  type: string
  description: string | null
  total_payment: string
  status: string
  business_unit: string | null
  employee_id: string | null
  reimbursement_batch_id: string | null
  payment_date: string | null
  employee: { id: string; full_name: string } | null
}

export type ReimburseReportBatchRow = {
  id: string
  batch_no: string
  batch_date: string
  payment_method: string | null
  reference_no: string | null
  notes: string | null
  total_amount: string
  created_at: string
  item_count: number
}

type EmployeeOpt = { id: string; full_name: string }

interface Props {
  expenses: ReimburseReportExpenseRow[]
  employees: EmployeeOpt[]
  batches: ReimburseReportBatchRow[]
  initialFilters: {
    from: string
    to: string
    bu: string
    type: string
    employeeId: string
    view: 'payable' | 'paid'
  }
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  outline: 'none',
  fontFamily: 'inherit',
}

function buildSummary(rows: ReimburseReportExpenseRow[]) {
  const map = new Map<
    string,
    { name: string; count: number; total: number }
  >()
  for (const e of rows) {
    const key = e.employee_id ?? '_none'
    const name = e.employee?.full_name ?? '—'
    const cur = map.get(key) ?? { name, count: 0, total: 0 }
    cur.count += 1
    cur.total += parseFloat(e.total_payment || '0')
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([employee_id, v]) => ({ employee_id, ...v }))
    .sort((a, b) => b.total - a.total)
}

export function ReimburseReportClient({
  expenses,
  employees,
  batches,
  initialFilters,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchDate, setBatchDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [paymentMethod, setPaymentMethod] = useState('Transfer')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')

  const payableRows = useMemo(
    () =>
      expenses.filter(
        e =>
          e.status === 'Approved' &&
          (e.reimbursement_batch_id === null || e.reimbursement_batch_id === ''),
      ),
    [expenses],
  )

  const paidRows = useMemo(
    () => expenses.filter(e => e.status === 'Paid'),
    [expenses],
  )

  const listRows =
    initialFilters.view === 'paid' ? paidRows : payableRows

  const summaryRows = useMemo(
    () => buildSummary(listRows),
    [listRows],
  )

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const selectedTotal = useMemo(() => {
    let s = 0
    for (const id of selectedIds) {
      const e = payableRows.find(x => x.id === id)
      if (e) s += parseFloat(e.total_payment || '0')
    }
    return s
  }, [payableRows, selectedIds])

  const allSelectableIds = payableRows.map(e => e.id)
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every(id => selected[id])

  function toggleAll() {
    if (allSelected) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      allSelectableIds.forEach(id => {
        next[id] = true
      })
      setSelected(next)
    }
  }

  async function submitBatch() {
    setError(null)
    if (!selectedIds.length) {
      setError('Pilih minimal satu expense yang siap dibayar.')
      return
    }
    if (!batchDate) {
      setError('Tanggal bayar wajib diisi.')
      return
    }
    if (!paymentMethod.trim()) {
      setError('Metode pembayaran wajib diisi.')
      return
    }
    setLoading(true)
    try {
      const res = await createReimbursementBatch(
        selectedIds,
        batchDate,
        paymentMethod.trim(),
        referenceNo.trim() || null,
        notes.trim() || null,
      )
      if (!res.success) {
        setError(res.error ?? 'Gagal memproses batch')
        return
      }
      setSelected({})
      setReferenceNo('')
      setNotes('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/reports"
          style={{
            fontSize: '12px',
            color: '#64748B',
            textDecoration: 'none',
            marginBottom: '8px',
            display: 'inline-block',
          }}
        >
          ← Laporan
        </Link>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#0F172A',
            margin: '4px 0',
          }}
        >
          Laporan Reimburse (Batch)
        </h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Ringkasan per karyawan, daftar payable, dan riwayat batch payout.
        </p>
      </div>

      <form
        method="get"
        action="/reports/reimburse"
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#0F172A',
            margin: '0 0 16px',
          }}
        >
          Filter
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Dari tanggal transaksi
            </label>
            <input
              type="date"
              name="from"
              defaultValue={initialFilters.from}
              style={inp}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Sampai tanggal transaksi
            </label>
            <input
              type="date"
              name="to"
              defaultValue={initialFilters.to}
              style={inp}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Business unit
            </label>
            <select name="bu" defaultValue={initialFilters.bu} style={inp}>
              <option value="">Semua</option>
              <option value="RKT">RKT</option>
              <option value="SPH">SPH</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Tipe expense
            </label>
            <select name="type" defaultValue={initialFilters.type} style={inp}>
              <option value="">Semua</option>
              <option value="PO">PO</option>
              <option value="Reimburse">Reimburse</option>
              <option value="Salary">Salary</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Karyawan
            </label>
            <select
              name="employee"
              defaultValue={initialFilters.employeeId}
              style={inp}
            >
              <option value="">Semua</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '5px',
              }}
            >
              Tampilan daftar
            </label>
            <select name="view" defaultValue={initialFilters.view} style={inp}>
              <option value="payable">Payable (Approved, belum batch)</option>
              <option value="paid">Sudah dibayar (Paid)</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            background: '#0F172A',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Terapkan filter
        </button>
      </form>

      {/* Summary */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#0F172A',
            margin: '0 0 12px',
          }}
        >
          Ringkasan per karyawan
          <span
            style={{
              fontWeight: '400',
              color: '#64748B',
              fontSize: '12px',
              marginLeft: '8px',
            }}
          >
            (
            {initialFilters.view === 'paid'
              ? 'Paid pada rentang transaksi'
              : 'Approved & belum masuk batch'}
            )
          </span>
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Karyawan</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Jumlah</th>
                <th style={{ textAlign: 'right', padding: '8px 10px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '16px', color: '#64748B' }}>
                    Tidak ada data untuk filter ini.
                  </td>
                </tr>
              ) : (
                summaryRows.map(row => (
                  <tr key={row.employee_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px' }}>{row.name}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {row.count}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatIDR(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payable list + batch action */}
      {initialFilters.view === 'payable' && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#0F172A',
              margin: '0 0 12px',
            }}
          >
            Expense siap dibayar
          </h2>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px' }}>
            Centang transaksi Approved yang belum masuk batch, lalu isi metadata payout.
          </p>
          {error && (
            <p style={{ fontSize: '13px', color: '#B91C1C', margin: '0 0 12px' }}>{error}</p>
          )}
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ width: 36, padding: '8px' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!allSelectableIds.length}
                    />
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Ref</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Tanggal</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Tipe</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Karyawan</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>BU</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {payableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px', color: '#64748B' }}>
                      Tidak ada expense payable pada filter ini.
                    </td>
                  </tr>
                ) : (
                  payableRows.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={!!selected[e.id]}
                          onChange={() =>
                            setSelected(s => ({ ...s, [e.id]: !s[e.id] }))
                          }
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>{e.ref_no ?? '—'}</td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                        {e.transaction_date}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{e.type}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {e.employee?.full_name ?? '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{e.business_unit ?? '—'}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatIDR(e.total_payment)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              borderTop: '1px solid #E2E8F0',
              paddingTop: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Tanggal bayar (payment_date)
              </label>
              <input
                type="date"
                value={batchDate}
                onChange={ev => setBatchDate(ev.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Metode pembayaran
              </label>
              <input
                value={paymentMethod}
                onChange={ev => setPaymentMethod(ev.target.value)}
                placeholder="Transfer, dll."
                style={inp}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Referensi / no. bukti
              </label>
              <input
                value={referenceNo}
                onChange={ev => setReferenceNo(ev.target.value)}
                placeholder="Opsional"
                style={inp}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                Catatan batch
              </label>
              <input
                value={notes}
                onChange={ev => setNotes(ev.target.value)}
                placeholder="Opsional"
                style={inp}
              />
            </div>
          </div>
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => void submitBatch()}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: loading ? '#94A3B8' : '#166534',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Memproses…' : 'Proses reimburse (batch)'}
            </button>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              Dipilih: {selectedIds.length} · {formatIDR(selectedTotal)}
            </span>
          </div>
        </div>
      )}

      {initialFilters.view === 'paid' && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#0F172A',
              margin: '0 0 12px',
            }}
          >
            Expense sudah dibayar
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Ref</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Tanggal</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Tipe</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Karyawan</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>Bayar</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>
                      Tidak ada expense Paid pada filter ini.
                    </td>
                  </tr>
                ) : (
                  listRows.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 6px' }}>{e.ref_no ?? '—'}</td>
                      <td style={{ padding: '8px 6px' }}>{e.transaction_date}</td>
                      <td style={{ padding: '8px 6px' }}>{e.type}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {e.employee?.full_name ?? '—'}
                      </td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                        {e.payment_date ?? '—'}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatIDR(e.total_payment)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch history */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#0F172A',
            margin: '0 0 4px',
          }}
        >
          Riwayat batch
        </h2>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px' }}>
          Batch dengan tanggal payout dalam rentang filter tanggal bayar (batch_date).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>No. batch</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Tanggal</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Metode</th>
                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Referensi</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>
                    Belum ada batch pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 6px', fontWeight: '500' }}>{b.batch_no}</td>
                    <td style={{ padding: '8px 6px' }}>{b.batch_date}</td>
                    <td style={{ padding: '8px 6px' }}>{b.payment_method ?? '—'}</td>
                    <td style={{ padding: '8px 6px' }}>{b.reference_no ?? '—'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{b.item_count}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatIDR(b.total_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
