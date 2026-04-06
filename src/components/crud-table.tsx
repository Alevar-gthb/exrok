'use client'

// src/components/crud-table.tsx
// Generic CRUD table — dipakai oleh semua settings pages

import { useState } from 'react'

export interface CrudField {
  key: string
  label: string
  type?: 'text' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
  placeholder?: string
  readOnly?: boolean
}

interface CrudTableProps {
  title: string
  data: Record<string, any>[]
  fields: CrudField[]
  displayCols: { key: string; label: string; render?: (row: any) => React.ReactNode }[]
  onSave: (values: Record<string, string>) => Promise<{ error?: string }>
  onDelete: (id: string) => Promise<{ error?: string }>
  emptyText?: string
}

const S = {
  inp: { width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #E2E8F0', borderRadius: '8px', outline: 'none', color: '#0F172A', background: '#fff', fontFamily: 'inherit' } as React.CSSProperties,
  lbl: { display: 'block', fontSize: '12px', fontWeight: '500' as const, color: '#475569', marginBottom: '4px' },
}

export function CrudTable({ title, data, fields, displayCols, onSave, onDelete, emptyText }: CrudTableProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditing(null)
    setForm(Object.fromEntries(fields.map(f => [f.key, ''])))
    setShowForm(true); setError(null)
  }

  function openEdit(row: Record<string, any>) {
    setEditing(row)
    setForm(Object.fromEntries(fields.map(f => [f.key, row[f.key] ?? ''])))
    setShowForm(true); setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const result = await onSave({ ...form, id: editing?.id ?? '' })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus data ini?')) return
    setDeleting(id)
    const result = await onDelete(id)
    setDeleting(null)
    if (result.error) alert(result.error)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#0F172A' }}>{data.length} {title}</span>
        <button onClick={openAdd} style={{ padding: '7px 14px', background: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer', fontWeight: '500' }}>+ Tambah</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: '0 0 14px' }}>{editing ? 'Edit' : 'Tambah'} {title}</h3>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              {fields.filter(f => !f.readOnly).map(f => (
                <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                  <label style={S.lbl}>{f.label}{f.required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.inp} required={f.required}>
                      <option value="">Pilih...</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...S.inp, resize: 'none' }} rows={2} placeholder={f.placeholder} required={f.required} />
                  ) : (
                    <input type="text" value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.inp} placeholder={f.placeholder} required={f.required} />
                  )}
                </div>
              ))}
            </div>
            {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>⚠ {error}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: '13px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}>Batal</button>
              <button type="submit" disabled={saving} style={{ padding: '7px 16px', fontSize: '13px', fontWeight: '500', background: saving ? '#94A3B8' : '#0F172A', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        {data.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>{emptyText ?? 'Belum ada data'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {displayCols.map(c => (
                    <th key={c.key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#475569', letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < data.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    {displayCols.map(c => (
                      <td key={c.key} style={{ padding: '11px 14px', color: '#334155' }}>
                        {c.render ? c.render(row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(row)} style={{ padding: '3px 10px', fontSize: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}>Edit</button>
                        <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} style={{ padding: '3px 10px', fontSize: '11px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', color: '#991B1B' }}>
                          {deleting === row.id ? '...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
