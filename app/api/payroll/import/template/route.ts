import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { PAYROLL_COMPONENT_COLUMN_MAP, PAYROLL_REQUIRED_HEADERS, PAYROLL_PROJECT_LIST_HEADER } from '@/lib/payroll-import/mapping'

type ProjectRef = { id: string; name: string | null }
type LineRow = {
  employee_id: string
  gross_income: string | number | null
  ter_category: string | null
  ter_rate: string | number | null
  pph21_excel: string | number | null
  amount: string | number | null
  components_snapshot: unknown
  employee:
    | {
        full_name: string | null
        npwp: string | null
        tax_status: string | null
        ptkp_status: string | null
      }
    | {
        full_name: string | null
        npwp: string | null
        tax_status: string | null
        ptkp_status: string | null
      }[]
    | null
  project: ProjectRef | ProjectRef[] | null
}

type NormalizedLineRow = {
  employee_id: string
  gross_income: string | number | null
  ter_category: string | null
  ter_rate: string | number | null
  pph21_excel: string | number | null
  amount: string | number | null
  components_snapshot: unknown
  employee: {
    full_name: string | null
    npwp: string | null
    tax_status: string | null
    ptkp_status: string | null
  } | null
  project: ProjectRef | null
}

function toNumeric(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function extractComponentValues(snapshot: unknown): Record<string, number> {
  if (!snapshot || typeof snapshot !== 'object') return {}
  const record = snapshot as { components?: unknown }
  if (!record.components || typeof record.components !== 'object' || Array.isArray(record.components)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(record.components as Record<string, unknown>)) {
    if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : 0
    else if (typeof value === 'string') out[key] = toNumeric(value)
  }
  return out
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const me = await fetchMySessionEmployee(supabase)
  if (!me?.role || !['owner', 'finance'].includes(me.role)) {
    return NextResponse.json({ success: false, error: 'Role tidak diizinkan.' }, { status: 403 })
  }

  const { data: latestRun, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, period_year, period_month')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runError) return NextResponse.json({ success: false, error: runError.message }, { status: 500 })
  if (!latestRun) {
    return NextResponse.json({ success: false, error: 'Belum ada payroll run untuk dijadikan template.' }, { status: 404 })
  }

  const { data: rawLines, error: linesError } = await supabase
    .from('payroll_run_lines')
    .select(
      `
      employee_id,
      gross_income,
      ter_category,
      ter_rate,
      pph21_excel,
      amount,
      components_snapshot,
      employee:employees(full_name, npwp, tax_status, ptkp_status),
      project:projects(id, name)
    `
    )
    .eq('run_id', latestRun.id)
    .order('employee_id')

  if (linesError) return NextResponse.json({ success: false, error: linesError.message }, { status: 500 })
  const raw = (rawLines ?? []) as LineRow[]
  if (!raw.length) {
    return NextResponse.json({ success: false, error: 'Payroll run terakhir belum memiliki baris payroll.' }, { status: 404 })
  }
  const lines: NormalizedLineRow[] = raw.map(line => ({
    employee_id: line.employee_id,
    gross_income: line.gross_income,
    ter_category: line.ter_category,
    ter_rate: line.ter_rate,
    pph21_excel: line.pph21_excel,
    amount: line.amount,
    components_snapshot: line.components_snapshot,
    employee: Array.isArray(line.employee) ? line.employee[0] ?? null : line.employee,
    project: Array.isArray(line.project) ? line.project[0] ?? null : line.project,
  }))

  const employeeIds = [...new Set(lines.map(line => line.employee_id))]
  const { data: assignRows, error: assignErr } = await supabase
    .from('employee_project_assignments')
    .select('employee_id, project:projects(id, name)')
    .in('employee_id', employeeIds)
    .is('ended_on', null)
  if (assignErr) return NextResponse.json({ success: false, error: assignErr.message }, { status: 500 })

  const projectsByEmployee = new Map<string, Map<string, string>>()
  for (const row of assignRows ?? []) {
    const projectRaw = (row as { project?: ProjectRef | ProjectRef[] | null }).project
    const project = Array.isArray(projectRaw) ? projectRaw[0] : projectRaw
    if (!project?.id) continue
    const byId = projectsByEmployee.get((row as { employee_id: string }).employee_id) ?? new Map<string, string>()
    byId.set(project.id, project.name ?? '')
    projectsByEmployee.set((row as { employee_id: string }).employee_id, byId)
  }

  const linesByEmployee = new Map<string, NormalizedLineRow>()
  for (const line of lines) {
    if (!linesByEmployee.has(line.employee_id)) linesByEmployee.set(line.employee_id, line)
    if (line.project?.id) {
      const byId = projectsByEmployee.get(line.employee_id) ?? new Map<string, string>()
      byId.set(line.project.id, line.project.name ?? '')
      projectsByEmployee.set(line.employee_id, byId)
    }
  }

  const workbook = new ExcelJS.Workbook()
  const monthName = new Date(Date.UTC(latestRun.period_year, latestRun.period_month - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    .toUpperCase()
  const sheet = workbook.addWorksheet(monthName)
  const headers = [...PAYROLL_REQUIRED_HEADERS, PAYROLL_PROJECT_LIST_HEADER, ...PAYROLL_COMPONENT_COLUMN_MAP.map(c => c.header)]
  sheet.addRow(headers)

  for (const [employeeId, line] of linesByEmployee.entries()) {
    const componentValues = extractComponentValues(line.components_snapshot)
    const projectList = [...(projectsByEmployee.get(employeeId)?.values() ?? [])].filter(Boolean).join(', ')
    const rowValues: Record<string, string | number> = {
      NPWP: line.employee?.npwp ?? '',
      'Nama Pegawai': line.employee?.full_name ?? '',
      'Status Pajak': line.employee?.tax_status ?? 'Gross',
      'Status PTKP': line.employee?.ptkp_status ?? '',
      'Penghasilan Bruto': toNumeric(line.gross_income),
      'Kategori TER': line.ter_category ?? '',
      TER: toNumeric(line.ter_rate),
      'PPh 21': toNumeric(line.pph21_excel),
      THP: toNumeric(line.amount),
      Transfer: toNumeric(line.amount),
      [PAYROLL_PROJECT_LIST_HEADER]: projectList,
    }
    for (const comp of PAYROLL_COMPONENT_COLUMN_MAP) {
      rowValues[comp.header] = toNumeric(componentValues[comp.code])
    }
    sheet.addRow(headers.map(header => rowValues[header] ?? ''))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `payroll-template-${latestRun.period_year}-${String(latestRun.period_month).padStart(2, '0')}.xlsx`
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
