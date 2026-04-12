import type { ApprovalRule } from '@/types/database.types'

/** Rule aktif, urutkan priority ASC lalu ambil pertama yang cocok (sama seperti submit_expense di DB). */
export function findMatchingRule(
  rules: ApprovalRule[],
  amount: number,
  businessUnit: string | null | undefined,
  expenseType: string | null | undefined
): ApprovalRule | null {
  const sorted = [...rules]
    .filter(r => r.is_active)
    .sort((a, b) => a.priority - b.priority)

  for (const r of sorted) {
    const min = parseFloat(r.min_amount)
    const max = r.max_amount != null && r.max_amount !== '' ? parseFloat(r.max_amount) : Infinity
    if (amount < min) continue
    if (amount > max) continue
    if (r.business_unit && r.business_unit !== businessUnit) continue
    if (r.expense_type && r.expense_type !== expenseType) continue
    return r
  }
  return null
}
