// ============================================================
// src/lib/ocr/receipt-parser.ts
// Claude Vision prompt builder + response parser
// ============================================================

import { OcrReceiptResult } from '@/types/ocr'

// ----------------------------------------------------------------
// PROMPT
// ----------------------------------------------------------------
export const RECEIPT_OCR_PROMPT = `Kamu adalah sistem OCR cerdas untuk aplikasi expense management perusahaan Indonesia (PT Roketin Kreatif Teknologi).

Tugasmu: Analisis gambar bon/struk/invoice/kuitansi dan ekstrak semua informasi relevan.

Konteks bisnis:
- Perusahaan bekerja di industri teknologi kreatif
- Vendor bisa dari Indonesia atau luar negeri
- Mata uang default: IDR. Jika ada mata uang lain, tetap ekstrak angkanya
- PPN Indonesia saat ini: 11% (bukan 12%)

INSTRUKSI PENTING:
1. Return HANYA raw JSON — tanpa markdown, tanpa backtick, tanpa penjelasan
2. Jika suatu field tidak bisa dibaca, isi dengan null
3. Untuk nominal: angka INTEGER saja, tanpa titik/koma/simbol mata uang
4. confidence_score: 0.0 (tidak yakin sama sekali) – 1.0 (sangat yakin)
5. low_confidence_fields: daftar nama field yang kamu tidak yakin nilainya
6. service_charge: isi dari baris bon berlabel Service Fee, Service Charge, Biaya Layanan, PB1, Gratuity, atau sejenisnya (bukan PPN). Jika tidak ada, null.

FORMAT JSON yang harus dikembalikan:
{
  "vendor_name": "string atau null",
  "transaction_date": "YYYY-MM-DD atau null",
  "subtotal": angka_integer_atau_null,
  "has_vat": true_atau_false,
  "vat_rate": 0.11_atau_nilai_lain_atau_null,
  "vat_amount": angka_integer_atau_null,
  "service_charge": angka_integer_atau_null,
  "total_amount": angka_integer_atau_null,
  "payment_method": "Cash|Transfer Bank|Kartu Kredit|QRIS|Debit|null",
  "items_summary": "ringkasan 1-2 kalimat apa yang dibeli",
  "raw_items": [
    {
      "name": "nama item",
      "qty": angka_atau_null,
      "unit_price": angka_atau_null,
      "total": angka_atau_null
    }
  ],
  "category_suggestion": "operational|marketing|travel|it|employee|bpjs|tax",
  "confidence_score": 0.0_sampai_1.0,
  "low_confidence_fields": ["field1", "field2"],
  "notes": "catatan tambahan jika ada hal penting (mis: bon dalam mata uang asing, gambar blur, dll) atau null"
}

Panduan category_suggestion:
- operational: listrik, air, office supplies, printer, maintenance, ATK
- marketing: iklan, event, merchandise, hadiah klien, fotografi
- travel: tiket, hotel, bensin, parkir, toll, makan (perjalanan dinas)
- it: software subscription, domain, hosting, hardware, repair gadget
- employee: makan siang tim, outing, training, seragam, benefit non-BPJS
- bpjs: iuran BPJS, kesehatan tenaga kerja terkait BPJS
- tax: pajak, perpajakan, konsultan pajak, SPT, pemotongan pajak`

// ----------------------------------------------------------------
// PARSER
// ----------------------------------------------------------------
export function parseOcrResponse(rawText: string): OcrReceiptResult {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude tidak mengembalikan JSON yang valid')
  }

  let parsed: Partial<OcrReceiptResult>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Gagal parse JSON dari response Claude')
  }

  return {
    vendor_name: sanitizeString(parsed.vendor_name),
    transaction_date: sanitizeDate(parsed.transaction_date),
    subtotal: sanitizeNumber(parsed.subtotal),
    has_vat: Boolean(parsed.has_vat),
    vat_rate: sanitizeNumber(parsed.vat_rate),
    vat_amount: sanitizeNumber(parsed.vat_amount),
    service_charge: sanitizeNumber(parsed.service_charge),
    total_amount: sanitizeNumber(parsed.total_amount),
    payment_method: sanitizePaymentMethod(parsed.payment_method as string),
    items_summary: sanitizeString(parsed.items_summary),
    raw_items: Array.isArray(parsed.raw_items) ? parsed.raw_items : [],
    category_suggestion: sanitizeCategory(parsed.category_suggestion as string),
    confidence_score: Math.min(1, Math.max(0, Number(parsed.confidence_score) || 0)),
    low_confidence_fields: Array.isArray(parsed.low_confidence_fields)
      ? parsed.low_confidence_fields
      : [],
    notes: sanitizeString(parsed.notes),
  }
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------
function sanitizeString(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()
  return s === 'null' ? null : s
}

function sanitizeNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : Math.round(n)
}

function sanitizeDate(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return s
  }
  return null
}

function sanitizePaymentMethod(val: string): OcrReceiptResult['payment_method'] {
  const valid = ['Cash', 'Transfer Bank', 'Kartu Kredit', 'QRIS', 'Debit']
  if (!val) return null
  const found = valid.find(v => v.toLowerCase() === val.toLowerCase())
  return (found as OcrReceiptResult['payment_method']) ?? null
}

function sanitizeCategory(val: string): OcrReceiptResult['category_suggestion'] {
  const valid = ['operational', 'marketing', 'travel', 'it', 'employee', 'bpjs', 'tax']
  if (valid.includes(val)) return val as OcrReceiptResult['category_suggestion']
  return 'operational'
}
