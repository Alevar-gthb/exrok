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
  /** Header Excel yang dipetakan ke komponen ini (dipakai importer payroll). */
  excel_aliases?: string[] | null
}

/** Baris form: flag dipetakan ke string untuk select CrudTable */
type CrudRow = TemplateRow & {
  aktif: string
  gaji_bulanan: string
  /** Label tampilan jenis: "Penambah" / "Pengurang" (mapping bolak-balik ke kind earning/deduction). */
  jenis_label: string
  /** Comma-separated text untuk form CrudTable. */
  excel_aliases_text: string
}

const KIND_LABEL_PENAMBAH = 'Penambah (+)'
const KIND_LABEL_PENGURANG = 'Pengurang (\u2212)'

function kindToLabel(kind: string): string {
  return kind === 'deduction' ? KIND_LABEL_PENGURANG : KIND_LABEL_PENAMBAH
}

function labelToKind(label: string): 'earning' | 'deduction' {
  return label === KIND_LABEL_PENGURANG ? 'deduction' : 'earning'
}

function parseAliases(input: string): string[] {
  return [...new Set(input.split(',').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}

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
        jenis_label: kindToLabel(r.kind),
        excel_aliases_text: (r.excel_aliases ?? []).join(', '),
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
        case 'jenis_label':
          return compareText(a.jenis_label, b.jenis_label, dir)
        case 'aktif':
          return compareText(a.aktif, b.aktif, dir)
        case 'gaji_bulanan':
          return compareText(a.gaji_bulanan, b.gaji_bulanan, dir)
        case 'excel_aliases_text':
          return compareText(a.excel_aliases_text, b.excel_aliases_text, dir)
        default:
          return 0
      }
    })
    return copy
  }, [crudData, tableSort])

  async function load() {
    const { data: d } = await supabase
      .from('salary_component_templates')
      .select('id, code, label, kind, is_active, include_in_monthly_payroll, excel_aliases')
      .order('code')
    setRows((d as TemplateRow[]) ?? [])
  }

  async function onSave(values: Record<string, string>) {
    const payload = {
      code: values.code.trim(),
      label: values.label.trim(),
      kind: labelToKind(values.jenis_label),
      is_active: values.aktif === 'Ya',
      include_in_monthly_payroll: values.gaji_bulanan === 'Ya',
      excel_aliases: parseAliases(values.excel_aliases_text ?? ''),
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
        {
          key: 'jenis_label',
          label: 'Pengaruh ke total',
          type: 'select',
          options: [KIND_LABEL_PENAMBAH, KIND_LABEL_PENGURANG],
          required: true,
        },
        { key: 'aktif', label: 'Aktif', type: 'select', options: ['Ya', 'Tidak'], required: true },
        {
          key: 'gaji_bulanan',
          label: 'Dasar gaji bulanan',
          type: 'select',
          options: ['Ya', 'Tidak'],
          required: true,
        },
        {
          key: 'excel_aliases_text',
          label: 'Header Excel (pisahkan koma)',
          type: 'textarea',
          placeholder: 'Tunj Jabatan, Tunjangan Jabatan',
        },
      ]}
      displayCols={[
        { key: 'code', label: 'Kode', sortable: 'text' },
        { key: 'label', label: 'Label', sortable: 'text' },
        {
          key: 'jenis_label',
          label: 'Pengaruh ke total',
          sortable: 'text',
          render: (row: any) => {
            const isDeduction = row?.kind === 'deduction'
            const bg = isDeduction ? '#FEF2F2' : '#ECFDF5'
            const fg = isDeduction ? '#B91C1C' : '#047857'
            const border = isDeduction ? '#FECACA' : '#A7F3D0'
            const text = isDeduction ? KIND_LABEL_PENGURANG : KIND_LABEL_PENAMBAH
            return (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: bg,
                  color: fg,
                  border: `1px solid ${border}`,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {text}
              </span>
            )
          },
        },
        { key: 'aktif', label: 'Aktif', sortable: 'text' },
        { key: 'gaji_bulanan', label: 'Gaji bulanan', sortable: 'text' },
        {
          key: 'excel_aliases_text',
          label: 'Header Excel',
          sortable: 'text',
          render: (row: any) => {
            const aliases: string[] = row?.excel_aliases ?? []
            if (!aliases.length) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>-</span>
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {aliases.map((alias, idx) => (
                  <span
                    key={`${alias}-${idx}`}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    {alias}
                  </span>
                ))}
              </div>
            )
          },
        },
      ]}
      onSave={onSave}
      onDelete={onDelete}
      emptyText="Belum ada master komponen. Tambah minimal BASE (gaji pokok) sebagai Penambah."
    />
  )
}
