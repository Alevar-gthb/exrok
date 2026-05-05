'use client'

import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { useCrudTableSort } from '@/lib/crud-table-sort'
import { compareText } from '@/lib/table-sort'

type TemplateRow = {
  id: string
  code: string
  label: string
  kind: string
  is_active: boolean
  /** Default true jika kolom belum ada (sebelum migrasi). */
  include_in_monthly_payroll?: boolean
}

/** Baris form: flag dipetakan ke string untuk select CrudTable */
type CrudRow = TemplateRow & { aktif: string; gaji_bulanan: string }

export function SalaryComponentsSettingsClient({
  initialRows,
  myRole,
}: {
  initialRows: TemplateRow[]
  myRole: string
}) {
  const supabase = createClient()
  const [rows, setRows] = useState<TemplateRow[]>(initialRows)
  const { tableSort, sortProp } = useCrudTableSort()

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const crudData: CrudRow[] = useMemo(
    () =>
      rows.map(r => ({
        ...r,
        aktif: r.is_active ? 'Ya' : 'Tidak',
        gaji_bulanan: r.include_in_monthly_payroll !== false ? 'Ya' : 'Tidak',
      })),
    [rows]
  )

  const sortedCrudData = useMemo(() => {
    const key = tableSort.key
    if (!key) return crudData
    const dir = tableSort.dir
    const copy = [...crudData]
    copy.sort((a, b) => {
      switch (key) {
        case 'code':
          return compareText(a.code, b.code, dir)
        case 'label':
          return compareText(a.label, b.label, dir)
        case 'kind':
          return compareText(a.kind, b.kind, dir)
        case 'aktif':
          return compareText(a.aktif, b.aktif, dir)
        case 'gaji_bulanan':
          return compareText(a.gaji_bulanan, b.gaji_bulanan, dir)
        default:
          return 0
      }
    })
    return copy
  }, [crudData, tableSort])

  async function load() {
    const { data: d } = await supabase
      .from('salary_component_templates')
      .select('id, code, label, kind, is_active, include_in_monthly_payroll')
      .order('code')
    setRows((d as TemplateRow[]) ?? [])
  }

  async function onSave(values: Record<string, string>) {
    const payload = {
      code: values.code.trim(),
      label: values.label.trim(),
      kind: values.kind || 'earning',
      is_active: values.aktif === 'Ya',
      include_in_monthly_payroll: values.gaji_bulanan === 'Ya',
    }
    const { error } = values.id
      ? await supabase.from('salary_component_templates').update(payload).eq('id', values.id)
      : await supabase.from('salary_component_templates').insert(payload)
    if (!error) load()
    return { error: error?.message }
  }

  async function onDelete(id: string) {
    const { error } = await supabase.from('salary_component_templates').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  return (
    <CrudTable
      title="komponen master"
      data={sortedCrudData}
      sort={sortProp}
      showDelete={myRole === 'owner'}
      fields={[
        { key: 'code', label: 'Kode', required: true, placeholder: 'BASE, TUNJ_TRANSPORT' },
        { key: 'label', label: 'Label', required: true, placeholder: 'Gaji pokok' },
        { key: 'kind', label: 'Jenis', type: 'select', options: ['earning', 'deduction'], required: true },
        { key: 'aktif', label: 'Aktif', type: 'select', options: ['Ya', 'Tidak'], required: true },
        {
          key: 'gaji_bulanan',
          label: 'Dasar gaji bulanan',
          type: 'select',
          options: ['Ya', 'Tidak'],
          required: true,
        },
      ]}
      displayCols={[
        { key: 'code', label: 'Kode', sortable: 'text' },
        { key: 'label', label: 'Label', sortable: 'text' },
        { key: 'kind', label: 'Jenis', sortable: 'text' },
        { key: 'aktif', label: 'Aktif', sortable: 'text' },
        { key: 'gaji_bulanan', label: 'Gaji bulanan', sortable: 'text' },
      ]}
      onSave={onSave}
      onDelete={onDelete}
      emptyText="Belum ada master komponen. Tambah minimal BASE (gaji pokok) sebagai earning."
    />
  )
}
