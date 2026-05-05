'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CrudTableSort } from '@/components/crud-table'
import type { ColumnSortState } from '@/lib/table-sort'
import { cycleColumnSort } from '@/lib/table-sort'

export function useCrudTableSort() {
  const [tableSort, setTableSort] = useState<ColumnSortState>({ key: null, dir: 'asc' })
  const toggleSortColumn = useCallback((key: string) => {
    setTableSort(s => cycleColumnSort(s, key))
  }, [])
  const sortProp: CrudTableSort = useMemo(
    () => ({
      columnKey: tableSort.key,
      direction: tableSort.dir,
      onToggleColumn: toggleSortColumn,
    }),
    [tableSort.key, tableSort.dir, toggleSortColumn],
  )
  return { tableSort, sortProp }
}
