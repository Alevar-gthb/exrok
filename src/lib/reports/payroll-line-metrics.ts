import { summarizeCompensationRows } from '@/lib/compensation-summary'
import { parsePayrollAdjustments } from '@/lib/payroll-helpers'
import type { PayrollRunLine } from '@/types/database.types'

type Snap = {
  components?: Array<{
    kind: string
    amount: string | number
    include_in_monthly_payroll?: boolean
  }>
}

/**
 * Ringkasan laporan gaji per baris.
 * `nett` selalu dari `line.amount` (nilai yang dicatat di payroll); bruto & pemotongan untuk agregasi.
 */
export function payrollLineReportAmounts(line: PayrollRunLine): { gross: number; deductions: number; nett: number } {
  const nett = Number(line.amount) || 0
  const adj = parsePayrollAdjustments(line.adjustments)
  const snap = line.components_snapshot as Snap | null
  const comps = snap?.components ?? []
  const combined = [
    ...comps.map(c => ({
      kind: c.kind,
      amount: c.amount,
      include_in_monthly_payroll: c.include_in_monthly_payroll,
    })),
    ...adj.map(a => ({ kind: a.kind, amount: a.amount })),
  ]
  const s = summarizeCompensationRows(combined)

  const giRaw = line.gross_income != null && String(line.gross_income).trim() !== '' ? Number(line.gross_income) : NaN
  if (Number.isFinite(giRaw) && giRaw > 0) {
    const deductions = Math.max(0, giRaw - nett)
    return { gross: giRaw, deductions, nett }
  }

  if (s.gross > 0 || s.deductions > 0) {
    return { gross: s.gross, deductions: s.deductions, nett }
  }

  return { gross: nett, deductions: 0, nett }
}
