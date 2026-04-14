import type { ApprovalRule } from '@/types/database.types'

function whitelistOk(r: ApprovalRule, paymentMethod: string | null | undefined): boolean {
  const w = r.payment_methods
  if (w == null || w.length === 0) return true
  if (paymentMethod == null || paymentMethod === '') return false
  return w.includes(paymentMethod)
}

function blacklistOk(r: ApprovalRule, paymentMethod: string | null | undefined): boolean {
  const x = r.excluded_payment_methods
  if (x == null || x.length === 0) return true
  if (paymentMethod == null || paymentMethod === '') return true
  return !x.includes(paymentMethod)
}

/** Rule aktif, urutkan priority ASC lalu ambil pertama yang cocok (sama seperti submit_expense di DB). */
export function findMatchingRule(
  rules: ApprovalRule[],
  amount: number,
  businessUnit: string | null | undefined,
  expenseType: string | null | undefined,
  paymentMethod?: string | null | undefined
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
    if (!whitelistOk(r, paymentMethod)) continue
    if (!blacklistOk(r, paymentMethod)) continue
    return r
  }
  return null
}
