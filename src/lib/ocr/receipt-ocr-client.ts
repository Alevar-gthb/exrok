// ============================================================
// Client: POST /api/ocr/receipt dengan multipart file
// ============================================================

import type { OcrReceiptResult } from '@/types/ocr'

const MIME_OK = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export async function postReceiptOcrFromFile(file: File): Promise<OcrReceiptResult> {
  if (!MIME_OK.has(file.type)) {
    throw new Error('Format tidak didukung untuk OCR')
  }

  const formData = new FormData()
  formData.set('file', file)

  const res = await fetch('/api/ocr/receipt', {
    method: 'POST',
    body: formData,
  })

  const json = (await res.json()) as {
    success: boolean
    data?: OcrReceiptResult
    error?: string
  }

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error || 'Gagal membaca bon')
  }

  return json.data
}
