'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'

export default function ProjectsPage() {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])

  async function load() {
    const { data: d } = await supabase.from('projects').select('*').order('name')
    setData(d ?? [])
  }
  useEffect(() => { load() }, [])

  async function onSave(values: Record<string, string>) {
    const payload = { name: values.name, client_name: values.client_name || null, status: values.status || 'Active' }
    const { error } = values.id
      ? await supabase.from('projects').update(payload).eq('id', values.id)
      : await supabase.from('projects').insert(payload)
    if (!error) load()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  return (
    <CrudTable
      title="Proyek"
      data={data}
      fields={[
        { key: 'name', label: 'Nama Proyek', required: true, placeholder: 'Daya Group' },
        { key: 'client_name', label: 'Nama Klien', placeholder: 'PT Daya' },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Completed', 'On Hold'] },
      ]}
      displayCols={[
        { key: 'name', label: 'Nama Proyek' },
        { key: 'client_name', label: 'Klien' },
        { key: 'status', label: 'Status', render: row => (
          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', background: row.status === 'Active' ? '#F0FDF4' : '#F8FAFC', color: row.status === 'Active' ? '#166534' : '#64748B', border: `1px solid ${row.status === 'Active' ? '#86EFAC' : '#E2E8F0'}` }}>{row.status}</span>
        )},
      ]}
      onSave={onSave}
      onDelete={onDelete}
      emptyText="Belum ada proyek"
    />
  )
}
