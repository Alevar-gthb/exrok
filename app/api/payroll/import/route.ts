import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { importPayrollWorkbook } from '@/lib/payroll-import/importer'
import type { PayrollImportMode } from '@/types/payroll-import'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  let jobId: string | null = null
  try {
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
    const autoCreateProjectsRaw = String(form.get('autoCreateProjects') ?? 'false').trim()
    const jobIdRaw = String(form.get('job_id') ?? '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File .xlsx wajib diisi.' }, { status: 400 })
    }
    const year = Number(yearRaw)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: 'Tahun tidak valid.' }, { status: 400 })
    }
    const mode: PayrollImportMode = modeRaw === 'commit' ? 'commit' : 'dry-run'
    const autoCreateProjects = autoCreateProjectsRaw === 'true'
    const mismatchTolerance = Number(toleranceRaw)
    jobId = jobIdRaw || crypto.randomUUID()

    await supabase.from('payroll_import_jobs').upsert({
      id: jobId,
      created_by: me.id,
      mode,
      year,
      status: 'running',
      stage: 'starting',
      message: 'Memulai import payroll',
    })

    const bytes = await file.arrayBuffer()
    const summary = await importPayrollWorkbook({
      supabase,
      fileBuffer: new Uint8Array(bytes),
      mode,
      autoCreateProjects,
      year,
      userId: me.id,
      mismatchTolerance: Number.isFinite(mismatchTolerance) ? mismatchTolerance : 500,
      onProgress: async (progress) => {
        await supabase
          .from('payroll_import_jobs')
          .update({
            status: progress.status,
            stage: progress.stage,
            message: progress.message ?? null,
            sheets_processed: progress.sheetsProcessed,
            rows_processed: progress.rowsProcessed,
            employees_upserted: progress.employeesUpserted,
            components_upserted: progress.componentsUpserted,
            payroll_lines_upserted: progress.payrollLinesUpserted,
            mismatch_count: progress.mismatchCount,
            warnings: progress.warnings,
            errors: progress.errors,
          })
          .eq('id', jobId)
      },
    })

    await supabase
      .from('payroll_import_jobs')
      .update({
        status: 'completed',
        stage: summary.needsProjectConfirmation ? 'awaiting_project_confirmation' : 'completed',
        message: summary.needsProjectConfirmation ? 'Konfirmasi tambah project baru sebelum commit' : 'Import payroll selesai',
        sheets_processed: summary.sheetsProcessed,
        rows_processed: summary.rowsProcessed,
        employees_upserted: summary.employeesUpserted,
        components_upserted: summary.componentsUpserted,
        payroll_lines_upserted: summary.payrollLinesUpserted,
        mismatch_count: summary.mismatchCount,
        warnings: summary.warnings,
        errors: summary.errors,
      })
      .eq('id', jobId)

    return NextResponse.json({ success: true, data: summary, jobId })
  } catch (error) {
    if (jobId) {
      await supabase
        .from('payroll_import_jobs')
        .update({
          status: 'failed',
          stage: 'failed',
          message: 'Import payroll gagal',
          error_detail: error instanceof Error ? error.message : 'Internal server error',
        })
        .eq('id', jobId)
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
