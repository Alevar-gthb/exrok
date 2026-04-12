/** Ringkasan dari baris komponen gaji (earning / deduction). */
export function summarizeCompensationRows(rows: { kind: string; amount: string | number }[]) {
  let gross = 0
  let deductions = 0
  for (const r of rows) {
    const v = Number(r.amount)
    if (!Number.isFinite(v)) continue
    if (r.kind === 'earning') gross += v
    else if (r.kind === 'deduction') deductions += v
  }
  const net = gross - deductions
  return { gross, deductions, net }
}
