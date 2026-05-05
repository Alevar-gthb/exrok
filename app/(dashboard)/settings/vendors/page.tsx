'use client'
import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { useCrudTableSort } from '@/lib/crud-table-sort'
import { compareText } from '@/lib/table-sort'

export default function VendorsPage() {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])
  const { tableSort, sortProp } = useCrudTableSort()

  const sortedData = useMemo(() => {
    const key = tableSort.key
    if (!key) return data
    const dir = tableSort.dir
    const copy = [...data]
    copy.sort((a, b) => {
      switch (key) {
        case 'name':
          return compareText(a.name, b.name, dir)
        case 'type':
          return compareText(a.type, b.type, dir)
        case 'contact':
          return compareText(a.contact, b.contact, dir)
        default:
          return 0
      }
    })
    return copy
  }, [data, tableSort])

  async function load() {
    const { data: d } = await supabase.from('vendors').select('*').order('name')
    setData(d ?? [])
  }
  useEffect(() => { load() }, [])

  async function onSave(values: Record<string, string>) {
    const payload = { name: values.name, type: values.type || null, contact: values.contact || null, notes: values.notes || null }
    const { error } = values.id
      ? await supabase.from('vendors').update(payload).eq('id', values.id)
      : await supabase.from('vendors').insert(payload)
    if (!error) load()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from('vendors').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  return (
    <CrudTable
      title="Vendor"
      data={sortedData}
      sort={sortProp}
      fields={[
        { key: 'name', label: 'Nama Vendor', required: true, placeholder: 'PT Cloudflare' },
        { key: 'type', label: 'Tipe', type: 'select', options: ['Software', 'Hosting', 'Cleaning Service', 'Freelancer', 'Supplier', 'Consultant', 'Other'] },
        { key: 'contact', label: 'Kontak', placeholder: 'email / no. telp' },
        { key: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Info tambahan...' },
      ]}
      displayCols={[
        { key: 'name', label: 'Nama Vendor', sortable: 'text' },
        { key: 'type', label: 'Tipe', sortable: 'text', render: row => row.type
          ? <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: '#EFF6FF', color: '#1D4ED8' }}>{row.type}</span>
          : '—'
        },
        { key: 'contact', label: 'Kontak', sortable: 'text' },
      ]}
      onSave={onSave}
      onDelete={onDelete}
      emptyText="Belum ada vendor"
    />
  )
}
