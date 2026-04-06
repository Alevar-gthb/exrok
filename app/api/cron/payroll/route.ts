// app/api/cron/payroll/route.ts
// Dipanggil Railway Cron: 0 0 25 * *
import { createClient } from '@/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // Guard: hanya boleh dipanggil dari Railway (cek secret header)
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // 1. Ambil semua karyawan aktif yang punya salary_amount > 0
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, salary_amount')
    .eq('status', 'Active')
    .gt('salary_amount', 0)

  if (empErr || !employees?.length) {
    return NextResponse.json({ message: 'No active employees', count: 0 })
  }

  // 2. Bulan ini
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = now.getFullYear()
  const transactionDate = `${year}-${month}-25`

  // 3. Insert expenses type Salary untuk setiap karyawan
  const rows = employees.map(emp => ({
    transaction_date: transactionDate,
    type: 'Salary' as const,
    description: `Gaji ${emp.full_name} - ${month}/${year}`,
    amount: emp.salary_amount,
    vat: '0', admin_fee: '0', service_fee: '0',
    employee_id: emp.id,
    status: 'Pending Approval',
    is_reconciled: false,
  }))

  const { data, error: insErr } = await supabase.from('expenses').insert(rows).select('id')

  if (insErr) {
    console.error('[cron/payroll]', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  console.log(`[cron/payroll] Generated ${data?.length} salary drafts for ${month}/${year}`)
  return NextResponse.json({ message: 'Payroll generated', count: data?.length, month: `${month}/${year}` })
}

// Untuk test manual via GET (hanya development)
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return NextResponse.json({ message: 'Payroll cron ready. Use POST with x-cron-secret header.' })
}
