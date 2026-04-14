// ============================================================
// src/types/ocr.ts
// Type definitions untuk OCR receipt extraction
// ============================================================

export type PaymentMethod = 'Cash' | 'Transfer Bank' | 'Kartu Kredit' | 'QRIS' | 'Debit' | null

export type ExpenseCategory =
  | 'operational'
  | 'marketing'
  | 'travel'
  | 'it'
  | 'employee'
  | 'bpjs'
  | 'tax'

export interface OcrReceiptResult {
  // Core fields
  vendor_name: string | null
  transaction_date: string | null // ISO format: YYYY-MM-DD
  subtotal: number | null
  has_vat: boolean
  vat_rate: number | null // e.g. 0.11 for 11%
  vat_amount: number | null
  service_charge: number | null
  total_amount: number | null

  // Metadata
  payment_method: PaymentMethod
  items_summary: string | null // ringkasan item dalam 1-2 kalimat
  raw_items: OcrLineItem[] // detail item jika ada

  // Suggestions
  category_suggestion: ExpenseCategory

  // Confidence
  confidence_score: number // 0.0 – 1.0
  low_confidence_fields: string[] // field yang perlu diverifikasi
  notes: string | null // catatan tambahan dari Claude
}

export interface OcrLineItem {
  name: string
  qty: number | null
  unit_price: number | null
  total: number | null
}

export interface OcrApiRequest {
  image_base64: string
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
}

export interface OcrApiResponse {
  success: boolean
  data?: OcrReceiptResult
  error?: string
}
