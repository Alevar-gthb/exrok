'use client'

import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'

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
      data={crudData}
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
        { key: 'code', label: 'Kode' },
        { key: 'label', label: 'Label' },
        { key: 'kind', label: 'Jenis' },
        { key: 'aktif', label: 'Aktif' },
        { key: 'gaji_bulanan', label: 'Gaji bulanan' },
      ]}
      onSave={onSave}
      onDelete={onDelete}
      emptyText="Belum ada master komponen. Tambah minimal BASE (gaji pokok) sebagai earning."
    />
  )
}
