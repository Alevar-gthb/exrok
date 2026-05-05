'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { SortableTh } from '@/components/sortable-th'
import type { ColumnSortState } from '@/lib/table-sort'
import {
  compareNum,
  compareText,
  cycleColumnSort,
  parseDecimalString,
} from '@/lib/table-sort'

const S = {
  inp: { width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', color: '#0F172A', background: '#fff', fontFamily: 'inherit' } as React.CSSProperties,
  lbl: { display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px' } as React.CSSProperties,
}
const fo = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#94A3B8')
const fb = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#E2E8F0')

interface Item {
  id: string; kode_barang: string | null; name: string; type: string
  location: string | null; condition: string | null; purchase_price: string | null
  serial_number?: string | null
  initial_stock?: number | null; last_stock?: number | null
}

export default function InventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'all' | 'Asset' | 'Consumable'>('all')
  const [form, setForm] = useState({ kode_barang: '', name: '', type: 'Asset', location: '', condition: 'Baik', purchase_price: '', serial_number: '', initial_stock: '', last_stock: '' })
  const [error, setError] = useState<string | null>(null)
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })

  const toggleSortColumn = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false })
    setItems((data as Item[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const { error: err } = await supabase.from('inventory_items').insert({
      kode_barang: form.kode_barang || null,
      name: form.name, type: form.type,
      location: form.location || null, condition: form.condition || null,
      purchase_price: form.purchase_price ? form.purchase_price.replace(/\./g, '') : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); setForm({ kode_barang: '', name: '', type: 'Asset', location: '', condition: 'Baik', purchase_price: '', serial_number: '', initial_stock: '', last_stock: '' })
    load()
  }

  const displayed = tab === 'all' ? items : items.filter(i => i.type === tab)

  function stockSortValue(it: Item): number {
    if (it.type === 'Consumable' && it.initial_stock != null) return it.last_stock ?? 0
    return -1
  }

  const sortedDisplayed = useMemo(() => {
    const key = tableSort.key
    if (!key) return displayed
    const dir = tableSort.dir
    const copy = [...displayed]
    copy.sort((a, b) => {
      switch (key) {
        case 'kode_barang':
          return compareText(a.kode_barang, b.kode_barang, dir)
        case 'name':
          return compareText(a.name, b.name, dir)
        case 'type':
          return compareText(a.type, b.type, dir)
        case 'location':
          return compareText(a.location, b.location, dir)
        case 'condition':
          return compareText(a.condition, b.condition, dir)
        case 'stock':
          return compareNum(stockSortValue(a), stockSortValue(b), dir)
        case 'purchase_price':
          return compareNum(
            parseDecimalString(a.purchase_price),
            parseDecimalString(b.purchase_price),
            dir,
          )
        default:
          return 0
      }
    })
    return copy
  }, [displayed, tableSort])

  const TYPE_S: Record<string, { bg: string; color: string }> = {
    Asset: { bg: '#EFF6FF', color: '#1D4ED8' },
    Consumable: { bg: '#ECFDF5', color: '#065F46' },
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Inventaris</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>{items.length} item · {items.filter(i => i.type === 'Asset').length} aset · {items.filter(i => i.type === 'Consumable').length} consumable</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
          {showForm ? '× Tutup' : '+ Tambah Item'}
        </button>
      </div>

      {/* Form tambah */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', margin: '0 0 16px' }}>Item Baru</h2>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={S.lbl}>Tipe <span style={{ color: '#EF4444' }}>*</span></label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={S.inp} onFocus={fo} onBlur={fb}>
                  <option value="Asset">Asset</option>
                  <option value="Consumable">Consumable</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>Kode Barang</label>
                <input value={form.kode_barang} onChange={e => setForm(p => ({ ...p, kode_barang: e.target.value }))} style={S.inp} placeholder="INV-001" onFocus={fo} onBlur={fb} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.lbl}>Nama Barang <span style={{ color: '#EF4444' }}>*</span></label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.inp} placeholder="MacBook Pro M3" onFocus={fo} onBlur={fb} />
              </div>
              {form.type === 'Asset' && (
                <div>
                  <label style={S.lbl}>Nomor Seri</label>
                  <input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} style={S.inp} placeholder="C02XG2JHJHD3" onFocus={fo} onBlur={fb} />
                </div>
              )}
              <div>
                <label style={S.lbl}>Lokasi</label>
                <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} style={S.inp} placeholder="Kantor Jakarta" onFocus={fo} onBlur={fb} />
              </div>
              <div>
                <label style={S.lbl}>Kondisi</label>
                <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))} style={S.inp} onFocus={fo} onBlur={fb}>
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>Harga Beli (Rp)</label>
                <input type="text" inputMode="numeric" value={form.purchase_price}
                  onChange={e => { const r = e.target.value.replace(/[^0-9]/g, ''); setForm(p => ({ ...p, purchase_price: r ? parseInt(r).toLocaleString('id-ID') : '' })) }}
                  style={S.inp} placeholder="0" onFocus={fo} onBlur={fb} />
              </div>
              {form.type === 'Consumable' && (
                <>
                  <div>
                    <label style={S.lbl}>Stok Awal</label>
                    <input type="number" min="0" value={form.initial_stock} onChange={e => setForm(p => ({ ...p, initial_stock: e.target.value }))} style={S.inp} placeholder="0" onFocus={fo} onBlur={fb} />
                  </div>
                  <div>
                    <label style={S.lbl}>Stok Saat Ini</label>
                    <input type="number" min="0" value={form.last_stock} onChange={e => setForm(p => ({ ...p, last_stock: e.target.value }))} style={S.inp} placeholder="0" onFocus={fo} onBlur={fb} />
                  </div>
                </>
              )}
            </div>
            {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>⚠ {error}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: '13px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}>Batal</button>
              <button type="submit" disabled={saving} style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '500', background: saving ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {(['all', 'Asset', 'Consumable'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '5px 14px', fontSize: '12px', fontWeight: tab === t ? '500' : '400', borderRadius: '20px', border: '1px solid', borderColor: tab === t ? '#0F172A' : '#E2E8F0', background: tab === t ? '#0F172A' : '#fff', color: tab === t ? '#fff' : '#475569', cursor: 'pointer' }}>
            {t === 'all' ? 'Semua' : t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Memuat...</div>
        ) : sortedDisplayed.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: '#334155', margin: '0 0 4px' }}>Belum ada item inventaris</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              {`Klik "+ Tambah Item" untuk mulai mencatat`}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <SortableTh
                    label="Kode"
                    columnKey="kode_barang"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Nama"
                    columnKey="name"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Tipe"
                    columnKey="type"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Lokasi"
                    columnKey="location"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Kondisi"
                    columnKey="condition"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="text"
                  />
                  <SortableTh
                    label="Stok"
                    columnKey="stock"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="number"
                  />
                  <SortableTh
                    label="Harga Beli"
                    columnKey="purchase_price"
                    activeKey={tableSort.key}
                    direction={tableSort.dir}
                    onToggle={toggleSortColumn}
                    kind="number"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedDisplayed.map((item, i) => {
                  const ts = TYPE_S[item.type] ?? TYPE_S.Asset
                  return (
                    <tr key={item.id} style={{ borderBottom: i < sortedDisplayed.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>{item.kode_barang ?? '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: '500', color: '#0F172A' }}>{item.name}</div>
                        {item.serial_number && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px', fontFamily: 'monospace' }}>S/N: {item.serial_number}</div>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: ts.bg, color: ts.color }}>{item.type}</span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#475569' }}>{item.location ?? '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {item.condition ? (
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', background: item.condition === 'Baik' ? '#F0FDF4' : item.condition === 'Rusak Ringan' ? '#FFFBEB' : '#FEF2F2', color: item.condition === 'Baik' ? '#166534' : item.condition === 'Rusak Ringan' ? '#92400E' : '#991B1B' }}>
                            {item.condition}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#475569' }}>
                        {item.type === 'Consumable' && item.initial_stock != null
                          ? <span style={{ fontFamily: 'monospace' }}>{item.last_stock ?? 0} / {item.initial_stock}</span>
                          : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: '#334155' }}>
                        {item.purchase_price ? `Rp ${parseInt(item.purchase_price).toLocaleString('id-ID')}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lending — info banner */}
      <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', fontSize: '12px', color: '#92400E' }}>
        💡 Fitur <strong>Lending System</strong> (pinjam-kembali barang) akan tersedia segera — tabel <code>item_loans</code> sudah dirancang di roadmap DB.
      </div>
    </div>
  )
}
