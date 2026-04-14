import type { PayrollLineAdjustment } from '@/types/database.types'

export function netFromCompensationRows(
  rows: { kind: string; amount: string | number; include_in_monthly_payroll?: boolean }[]
): number {
  let n = 0
  for (const r of rows) {
    if (r.include_in_monthly_payroll === false) continue
    const v = Number(r.amount)
    if (!Number.isFinite(v)) continue
    if (r.kind === 'earning') n += v
    else n -= v
  }
  return n
}

export function netFromAdjustments(rows: PayrollLineAdjustment[]): number {
  let n = 0
  for (const r of rows) {
    const v = Number(r.amount)
    if (!Number.isFinite(v)) continue
    if (r.kind === 'earning') n += v
    else n -= v
  }
  return n
}

export function parsePayrollAdjustments(raw: unknown): PayrollLineAdjustment[] {
  if (!Array.isArray(raw)) return []
  const out: PayrollLineAdjustment[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.code !== 'string' || typeof o.label !== 'string') continue
    if (o.kind !== 'earning' && o.kind !== 'deduction') continue
    const amount = String(o.amount ?? '0')
    out.push({ code: o.code, label: o.label, kind: o.kind, amount })
  }
  return out
}

export function pickDefaultProjectId(
  assignments: { project_id: string; is_primary: boolean; ended_on: string | null }[]
): string | null {
  const active = assignments.filter(a => !a.ended_on)
  if (!active.length) return null
  const primary = active.find(a => a.is_primary)
  return (primary ?? active[0]).project_id
}
