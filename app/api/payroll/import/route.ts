import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { importPayrollWorkbook } from '@/lib/payroll-import/importer'
import type { PayrollImportMode } from '@/types/payroll-import'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const me = await fetchMySessionEmployee(supabase)
    if (!me?.role || !['owner', 'finance'].includes(me.role)) {
      return NextResponse.json({ success: false, error: 'Role tidak diizinkan.' }, { status: 403 })
    }

    const form = await req.formData()
    const file = form.get('file')
    const yearRaw = String(form.get('year') ?? '').trim()
    const modeRaw = String(form.get('mode') ?? 'dry-run').trim()
    const toleranceRaw = String(form.get('mismatchTolerance') ?? '500')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File .xlsx wajib diisi.' }, { status: 400 })
    }
    const year = Number(yearRaw)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: 'Tahun tidak valid.' }, { status: 400 })
    }
    const mode: PayrollImportMode = modeRaw === 'commit' ? 'commit' : 'dry-run'
    const mismatchTolerance = Number(toleranceRaw)

    const bytes = await file.arrayBuffer()
    const summary = await importPayrollWorkbook({
      supabase,
      fileBuffer: new Uint8Array(bytes),
      mode,
      year,
      userId: me.id,
      mismatchTolerance: Number.isFinite(mismatchTolerance) ? mismatchTolerance : 500,
    })

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
