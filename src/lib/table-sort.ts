/** Client-side table sorting helpers (locale id, case-insensitive text). */

export type SortDir = 'asc' | 'desc'

export type ColumnSortState = { key: string | null; dir: SortDir }

export function compareText(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDir,
): number {
  const sa = (a ?? '').toLowerCase()
  const sb = (b ?? '').toLowerCase()
  const c = sa.localeCompare(sb, 'id', { sensitivity: 'base' })
  return dir === 'asc' ? c : -c
}

export function compareNum(a: number, b: number, dir: SortDir): number {
  return dir === 'asc' ? a - b : b - a
}

/** Postgres / API numeric fields often arrive as strings. */
export function parseDecimalString(v: string | null | undefined): number {
  if (v == null || v === '') return 0
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

/**
 * Header click cycle: off → asc → desc → off (same column).
 * Matches CrudTable / employees list behavior.
 */
export function cycleColumnSort(prev: ColumnSortState, columnKey: string): ColumnSortState {
  if (prev.key !== columnKey) return { key: columnKey, dir: 'asc' }
  if (prev.dir === 'asc') return { key: columnKey, dir: 'desc' }
  return { key: null, dir: 'asc' }
}

export function sortHint(kind: 'text' | 'number', active: boolean, dir: SortDir): string {
  if (kind === 'number') {
    if (!active) return 'Urut angka: rendah–tinggi lalu tinggi–rendah'
    return dir === 'asc'
      ? 'Angka: rendah → tinggi. Klik untuk tinggi → rendah.'
      : 'Angka: tinggi → rendah. Klik untuk mereset urutan.'
  }
  if (!active) return 'Urut teks: A–Z lalu Z–A'
  return dir === 'asc' ? 'Teks: A–Z. Klik untuk Z–A.' : 'Teks: Z–A. Klik untuk mereset urutan.'
}
