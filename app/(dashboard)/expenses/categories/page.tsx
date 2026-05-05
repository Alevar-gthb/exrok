'use client'
import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { useCrudTableSort } from '@/lib/crud-table-sort'
import { compareText } from '@/lib/table-sort'

export default function CategoriesPage() {
  const supabase = createClient()
  const [cats, setCats] = useState<any[]>([])
  const [subcats, setSubcats] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const { tableSort: catSort, sortProp: catSortProp } = useCrudTableSort()
  const { tableSort: subSort, sortProp: subSortProp } = useCrudTableSort()

  const sortedCats = useMemo(() => {
    const key = catSort.key
    if (!key) return cats
    const dir = catSort.dir
    const copy = [...cats]
    copy.sort((a, b) => {
      switch (key) {
        case 'name':
          return compareText(a.name, b.name, dir)
        case 'code':
          return compareText(a.code, b.code, dir)
        default:
          return 0
      }
    })
    return copy
  }, [cats, catSort])

  const sortedSubcats = useMemo(() => {
    const key = subSort.key
    if (!key) return subcats
    const dir = subSort.dir
    const copy = [...subcats]
    copy.sort((a, b) => {
      if (key === 'name') return compareText(a.name, b.name, dir)
      return 0
    })
    return copy
  }, [subcats, subSort])

  async function loadCats() {
    const { data } = await supabase.from('expense_categories').select('*').order('name')
    setCats(data ?? [])
  }
  async function loadSubcats(catId: string) {
    const { data } = await supabase.from('expense_subcategories').select('*').eq('category_id', catId).order('name')
    setSubcats(data ?? [])
  }
  useEffect(() => { loadCats() }, [])
  useEffect(() => { if (selectedCat) loadSubcats(selectedCat) }, [selectedCat])

  async function onSaveCat(values: Record<string, string>) {
    const payload = { name: values.name, code: values.code || null } as any
    const { error } = values.id
      ? await supabase.from('expense_categories').update(payload).eq('id', values.id)
      : await supabase.from('expense_categories').insert(payload)
    if (!error) loadCats()
    return { error: error?.message }
  }
  async function onDeleteCat(id: string) {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (!error) { loadCats(); if (selectedCat === id) { setSelectedCat(null); setSubcats([]) } }
    return { error: error?.message }
  }

  async function onSaveSubcat(values: Record<string, string>) {
    if (!selectedCat) return { error: 'Pilih kategori dulu' }
    const payload = { name: values.name, category_id: selectedCat }
    const { error } = values.id
      ? await supabase.from('expense_subcategories').update({ name: values.name }).eq('id', values.id)
      : await supabase.from('expense_subcategories').insert(payload)
    if (!error) loadSubcats(selectedCat)
    return { error: error?.message }
  }
  async function onDeleteSubcat(id: string) {
    const { error } = await supabase.from('expense_subcategories').delete().eq('id', id)
    if (!error && selectedCat) loadSubcats(selectedCat)
    return { error: error?.message }
  }

  const selectedCatName = cats.find(c => c.id === selectedCat)?.name

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Categories */}
      <div style={{ flex: '1', minWidth: '280px' }}>
        <CrudTable
          title="Kategori"
          data={sortedCats}
          sort={catSortProp}
          fields={[
            { key: 'name', label: 'Nama Kategori', required: true, placeholder: 'Operational Costs' },
            { key: 'code', label: 'Kode', placeholder: 'OperationalCosts' },
          ]}
          displayCols={[
            { key: 'name', label: 'Kategori', sortable: 'text', render: row => (
              <button onClick={() => setSelectedCat(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: selectedCat === row.id ? '600' : '400', color: selectedCat === row.id ? '#0F172A' : '#334155', textAlign: 'left', padding: 0 }}>
                {row.name} {selectedCat === row.id ? '→' : ''}
              </button>
            )},
            { key: 'code', label: 'Kode', sortable: 'text' },
          ]}
          onSave={onSaveCat}
          onDelete={onDeleteCat}
        />
      </div>

      {/* Subcategories */}
      <div style={{ flex: '1', minWidth: '280px' }}>
        {selectedCat ? (
          <CrudTable
            title={`Subkategori — ${selectedCatName}`}
            data={sortedSubcats}
            sort={subSortProp}
            fields={[{ key: 'name', label: 'Nama Subkategori', required: true, placeholder: 'Office Supplies' }]}
            displayCols={[{ key: 'name', label: 'Subkategori', sortable: 'text' }]}
            onSave={onSaveSubcat}
            onDelete={onDeleteSubcat}
          />
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', border: '2px dashed #E2E8F0', borderRadius: '12px', color: '#94A3B8', fontSize: '13px' }}>
            Klik nama kategori untuk lihat subkategori
          </div>
        )}
      </div>
    </div>
  )
}
