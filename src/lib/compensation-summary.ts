type CompSummaryRow = {
  kind: string
  amount: string | number
  /** Jika false, baris diabaikan untuk ringkasan gaji bulanan (default true). */
  include_in_monthly_payroll?: boolean
}

/** Ringkasan dari baris komponen gaji (earning / deduction). */
export function summarizeCompensationRows(rows: CompSummaryRow[]) {
  let gross = 0
  let deductions = 0
  for (const r of rows) {
    if (r.include_in_monthly_payroll === false) continue
    const v = Number(r.amount)
    if (!Number.isFinite(v)) continue
    if (r.kind === 'earning') gross += v
    else if (r.kind === 'deduction') deductions += v
  }
  const net = gross - deductions
  return { gross, deductions, net }
}
