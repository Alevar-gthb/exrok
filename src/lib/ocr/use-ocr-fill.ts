'use client'

// ============================================================
// src/lib/ocr/use-ocr-fill.ts
// Mapping OcrReceiptResult → ExpenseFormValues (expense.schema)
// ============================================================

import type { UseFormSetValue } from 'react-hook-form'
import type { ExpenseFormValues } from '@/lib/validations/expense.schema'
import type { OcrReceiptResult } from '@/types/ocr'

const CATEGORY_MAP: Record<OcrReceiptResult['category_suggestion'], string> = {
  operational: 'be6920d3-570c-433a-8f69-87780b18feba',
  marketing: 'c38f7d35-d611-4b26-91cc-398d9540327c',
  travel: '0fcdc0b1-cecf-4565-8ed5-3a3f7ca7dd8d',
  it: '4c7518e6-ad16-4317-9690-f5c21783f52c',
  employee: 'fe67373d-9619-46f2-a2cf-5bdbd8484f95',
  bpjs: 'fe67373d-9619-46f2-a2cf-5bdbd8484f95',
  tax: 'c49c0498-4a4c-444a-830b-4128eae2dd98',
}

function toAmountString(n: number | null | undefined): string | null {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null
  return String(Math.max(0, Math.round(Number(n))))
}

/** Map payment_method dari OCR ke opsi form (PAYMENT_METHODS). */
function mapPaymentMethod(ocr: OcrReceiptResult['payment_method']): string | null {
  if (!ocr) return null
  const m: Record<string, string> = {
    Cash: 'Petty Cash',
    'Transfer Bank': 'BCA',
    'Kartu Kredit': 'Panin Credit Card',
    QRIS: 'BCA',
    Debit: 'BCA',
  }
  return m[ocr] ?? null
}

export interface FillResult {
  filledFields: string[]
  skippedFields: string[]
}

export function useOcrFill(setValue: UseFormSetValue<ExpenseFormValues>): {
  fillFromOcr: (result: OcrReceiptResult) => FillResult
} {
  const fillFromOcr = (result: OcrReceiptResult): FillResult => {
    const filled: string[] = []
    const skipped: string[] = []

    const trySet = (
      field: keyof ExpenseFormValues,
      value: ExpenseFormValues[keyof ExpenseFormValues],
      condition = true
    ) => {
      if (!condition) {
        skipped.push(field as string)
        return
      }
      if (value === undefined) {
        skipped.push(field as string)
        return
      }
      if (typeof value === 'string' && value === '') {
        skipped.push(field as string)
        return
      }
      setValue(field, value as never, { shouldValidate: true, shouldDirty: true })
      filled.push(field as string)
    }

    const descParts = [
      result.vendor_name && `Vendor: ${result.vendor_name}`,
      result.items_summary,
      result.notes,
    ].filter(Boolean) as string[]

    let description = descParts.join('\n\n').trim()
    if (description.length < 3) {
      description = result.vendor_name
        ? `Bon ${result.vendor_name}`
        : 'Pengeluaran dari bon'
    }
    trySet('description', description.slice(0, 500) as ExpenseFormValues['description'])

    if (result.transaction_date) {
      trySet('transaction_date', result.transaction_date)
    }

    const amt = toAmountString(result.subtotal ?? result.total_amount ?? undefined)
    if (amt) trySet('amount', amt)

    trySet('has_vat', result.has_vat)
    if (result.has_vat) {
      const vatStr = toAmountString(result.vat_amount)
      if (vatStr) trySet('vat', vatStr)
    } else {
      trySet('vat', '0')
    }

    const svcStr = toAmountString(result.service_charge)
    if (svcStr) trySet('service_fee', svcStr)

    const catId = CATEGORY_MAP[result.category_suggestion]
    if (catId) trySet('category_id', catId)

    const pm = mapPaymentMethod(result.payment_method)
    if (pm) trySet('payment_method', pm)

    trySet('ocr_scanned', true)
    trySet('ocr_confidence', result.confidence_score)

    return { filledFields: filled, skippedFields: skipped }
  }

  return { fillFromOcr }
}
