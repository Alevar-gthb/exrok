// app/api/cron/payroll/route.ts
// Dipanggil scheduler (mis. Railway Cron) dengan header x-cron-secret.
// Membuat draft payroll run untuk bulan berjalan (sama dengan generator UI),
// tanpa otomatis submit ke expense — admin selesaikan di /payroll.
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { insertPayrollRunForPeriod } from '@/lib/payroll-run-insert'

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)
  const now = new Date()
  const periodYear = now.getFullYear()
  const periodMonth = now.getMonth() + 1

  const result = await insertPayrollRunForPeriod(supabase, periodYear, periodMonth, null)

  if (!result.ok) {
    if (result.error.includes('sudah ada')) {
      return NextResponse.json({ message: result.error, skipped: true })
    }
    console.error('[cron/payroll]', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  console.log(`[cron/payroll] Draft payroll run ${result.id} for ${periodMonth}/${periodYear}`)
  return NextResponse.json({
    message: 'Payroll draft created',
    run_id: result.id,
    period: `${periodMonth}/${periodYear}`,
  })
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return NextResponse.json({ message: 'Payroll cron ready. POST with x-cron-secret; requires SUPABASE_SERVICE_ROLE_KEY.' })
}
