// ============================================================
// app/api/ocr/receipt/route.ts
// Route Handler: OCR receipt via Claude Vision API
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { RECEIPT_OCR_PROMPT, parseOcrResponse } from '@/lib/ocr/receipt-parser'
import { OcrApiResponse } from '@/types/ocr'

const rateLimitMap = new Map<string, { count: number; reset: number }>()
const OCR_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.reset) {
    rateLimitMap.set(userId, { count: 1, reset: now + 60_000 })
    return true
  }

  if (entry.count >= 10) return false

  entry.count++
  return true
}

export async function POST(req: NextRequest): Promise<NextResponse<OcrApiResponse>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'File diperlukan' },
        { status: 400 }
      )
    }

    if (!OCR_ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format file OCR tidak didukung' },
        { status: 400 }
      )
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file terlalu besar. Maks 2MB.' },
        { status: 400 }
      )
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const imageBase64 = fileBuffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY tidak ditemukan di environment')
      return NextResponse.json(
        { success: false, error: 'Konfigurasi server error' },
        { status: 500 }
      )
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: RECEIPT_OCR_PROMPT,
              },
            ],
          },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text()
      console.error('Claude API error:', claudeRes.status, errBody)
      return NextResponse.json(
        { success: false, error: 'Gagal menghubungi Claude API' },
        { status: 502 }
      )
    }

    const claudeData = await claudeRes.json()
    const rawText =
      claudeData.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''

    const result = parseOcrResponse(rawText)

    const sessionEmp = await fetchMySessionEmployee(supabase)
    if (sessionEmp?.id) {
        void supabase
          .from('ocr_audit_logs')
          .insert({
            user_id: sessionEmp.id,
            vendor_detected: result.vendor_name,
            amount_detected: result.total_amount,
            confidence_score: result.confidence_score,
          })
          .then(({ error }) => {
            if (error) console.error('ocr_audit_logs insert:', error.message)
          })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('OCR route error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
