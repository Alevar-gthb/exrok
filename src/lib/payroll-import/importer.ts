import ExcelJS from 'exceljs'
import { PAYROLL_COMPONENT_COLUMN_MAP, PAYROLL_REQUIRED_HEADERS } from '@/lib/payroll-import/mapping'
import { computePph21System, deriveTerCategory, pickTerRate, shouldApplyTerMonthly } from '@/lib/payroll-import/ter'
import type { PayrollImportIssue, PayrollImportMode, PayrollImportSummary } from '@/types/payroll-import'

type SheetPeriod = { year: number; month: number }

type ParsedRow = {
  rowNumber: number
  npwp: string | null
  fullName: string
  taxStatus: string | null
  ptkpStatus: string | null
  grossIncome: number
  terCategoryExcel: string | null
  terRateExcel: number
  pph21Excel: number
  thpExcel: number
  transferExcel: number
  componentValues: Record<string, number>
}

const SHEET_MONTH: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

function readCellValue(v: unknown): unknown {
  if (v && typeof v === 'object' && 'result' in (v as Record<string, unknown>)) {
    return (v as { result?: unknown }).result ?? null
  }
  return v
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function normalizeNpwp(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

function headersFromRow(row: ExcelJS.Row): Record<string, number> {
  const map: Record<string, number> = {}
  row.eachCell((cell, colNumber) => {
    const h = toText(readCellValue(cell.value))
    if (h) map[h] = colNumber
  })
  return map
}

function parseSheetRows(ws: ExcelJS.Worksheet, issues: PayrollImportIssue[]): ParsedRow[] {
  const headerRow = ws.getRow(1)
  const headerMap = headersFromRow(headerRow)
  for (const need of PAYROLL_REQUIRED_HEADERS) {
    if (!headerMap[need]) {
      issues.push({
        rowNumber: 1,
        employeeName: '-',
        level: 'error',
        message: `Sheet ${ws.name} tidak memiliki header wajib: ${need}`,
      })
    }
  }
  if (issues.some(x => x.level === 'error' && x.rowNumber === 1)) return []

  const parsed: ParsedRow[] = []
  for (let i = 2; i <= ws.rowCount; i += 1) {
    const row = ws.getRow(i)
    const fullName = toText(readCellValue(row.getCell(headerMap['Nama Pegawai']).value))
    if (!fullName) continue
    const npwpRaw = toText(readCellValue(row.getCell(headerMap['NPWP']).value))
    const npwp = npwpRaw ? normalizeNpwp(npwpRaw) : null
    const grossIncome = toNumber(readCellValue(row.getCell(headerMap['Penghasilan Bruto']).value))
    const componentValues: Record<string, number> = {}
    for (const comp of PAYROLL_COMPONENT_COLUMN_MAP) {
      const col = headerMap[comp.header]
      if (!col) continue
      componentValues[comp.code] = toNumber(readCellValue(row.getCell(col).value))
    }
    parsed.push({
      rowNumber: i,
      npwp,
      fullName,
      taxStatus: toText(readCellValue(row.getCell(headerMap['Status Pajak']).value)) || null,
      ptkpStatus: toText(readCellValue(row.getCell(headerMap['Status PTKP']).value)) || null,
      grossIncome,
      terCategoryExcel: toText(readCellValue(row.getCell(headerMap['Kategori TER']).value)) || null,
      terRateExcel: toNumber(readCellValue(row.getCell(headerMap['TER']).value)),
      pph21Excel: toNumber(readCellValue(row.getCell(headerMap['PPh 21']).value)),
      thpExcel: toNumber(readCellValue(row.getCell(headerMap['THP']).value)),
      transferExcel: toNumber(readCellValue(row.getCell(headerMap['Transfer']).value)),
      componentValues,
    })
  }
  return parsed
}

async function fetchTerCards(supabase: any) {
  const { data, error } = await supabase.from('payroll_ter_rate_cards').select('category, brackets').eq('is_active', true)
  if (error) throw new Error(error.message)
  const out = new Map<string, Array<{ max: number; rate: number }>>()
  for (const row of data ?? []) {
    const brackets = Array.isArray(row.brackets) ? row.brackets : []
    out.set(
      row.category,
      brackets
        .map((x: unknown) => {
          const o = x as { max?: unknown; rate?: unknown }
          return { max: toNumber(o.max), rate: toNumber(o.rate) }
        })
        .filter((x: { max: number }) => x.max > 0)
    )
  }
  return out
}

async function ensureTemplates(
  supabase: any
): Promise<Map<string, { id: string; kind: 'earning' | 'deduction' }>> {
  const { data: existing } = await supabase.from('salary_component_templates').select('id, code, kind')
  const byCode = new Map<string, { id: string; kind: 'earning' | 'deduction' }>()
  for (const row of existing ?? []) byCode.set(row.code, { id: row.id, kind: row.kind })

  const missing = PAYROLL_COMPONENT_COLUMN_MAP.filter(c => !byCode.has(c.code))
  if (missing.length) {
    const { data: inserted, error } = await supabase
      .from('salary_component_templates')
      .insert(
        missing.map(m => ({
          code: m.code,
          label: m.label,
          kind: m.kind,
          is_active: true,
          include_in_monthly_payroll: m.code.toUpperCase() !== 'THR',
        }))
      )
      .select('id, code, kind')
    if (error) throw new Error(error.message)
    for (const row of inserted ?? []) byCode.set(row.code, { id: row.id, kind: row.kind })
  }
  return byCode
}

async function upsertEmployee(
  supabase: any,
  row: ParsedRow
): Promise<{ id: string }> {
  if (row.npwp) {
    const { data: e1 } = await supabase.from('employees').select('id').eq('npwp', row.npwp).maybeSingle()
    if (e1) {
      const { error } = await supabase
        .from('employees')
        .update({ full_name: row.fullName, tax_status: row.taxStatus, ptkp_status: row.ptkpStatus, status: 'Active' })
        .eq('id', e1.id)
      if (error) throw new Error(error.message)
      return { id: e1.id }
    }
  }

  const { data: ins, error: insErr } = await supabase
    .from('employees')
    .insert({
      full_name: row.fullName,
      npwp: row.npwp,
      tax_status: row.taxStatus ?? 'Gross',
      ptkp_status: row.ptkpStatus,
      status: 'Active',
      role: 'staff',
      email: null,
      salary_amount: '0',
      is_permanent: false,
      job_title: null,
    })
    .select('id')
    .single()
  if (insErr || !ins) throw new Error(insErr?.message ?? 'Gagal insert employee')
  return { id: ins.id }
}

async function upsertPayrollLine(params: {
  supabase: any
  runId: string
  employeeId: string
  row: ParsedRow
  terCategory: string | null
  terRate: number
  pph21System: number
}) {
  const { supabase, runId, employeeId, row, terCategory, terRate, pph21System } = params
  const pph21Gap = row.pph21Excel - pph21System
  const amount = row.transferExcel || row.thpExcel || row.grossIncome - row.pph21Excel

  const payload = {
    run_id: runId,
    employee_id: employeeId,
    project_id: null,
    amount: amount.toFixed(2),
    base_amount: row.grossIncome.toFixed(2),
    gross_income: row.grossIncome.toFixed(2),
    ter_category: terCategory,
    ter_rate: terRate.toFixed(6),
    pph21_excel: row.pph21Excel.toFixed(2),
    pph21_system: pph21System.toFixed(2),
    pph21_gap: pph21Gap.toFixed(2),
    adjustments: [],
    components_snapshot: {
      source: 'excel-import',
      ter_category_excel: row.terCategoryExcel,
      ter_rate_excel: row.terRateExcel,
      thp_excel: row.thpExcel,
      transfer_excel: row.transferExcel,
      components: row.componentValues,
    },
  }

  const { error } = await supabase
    .from('payroll_run_lines')
    .upsert(payload, { onConflict: 'run_id,employee_id', ignoreDuplicates: false })
  if (error) throw new Error(error.message)
}

async function upsertRun(
  supabase: any,
  period: SheetPeriod,
  userId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from('payroll_runs')
    .select('id')
    .eq('period_year', period.year)
    .eq('period_month', period.month)
    .maybeSingle()

  if (existing) return existing.id

  const { data: run, error } = await supabase
    .from('payroll_runs')
    .insert({
      period_year: period.year,
      period_month: period.month,
      status: 'draft',
      created_by: userId,
    })
    .select('id')
    .single()
  if (error || !run) throw new Error(error?.message ?? 'Gagal create payroll run')
  return run.id
}

export async function importPayrollWorkbook(params: {
  supabase: any
  fileBuffer: any
  mode: PayrollImportMode
  year: number
  userId: string | null
  mismatchTolerance: number
}): Promise<PayrollImportSummary> {
  const { supabase, fileBuffer, mode, year, userId, mismatchTolerance } = params
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer as any)
  const issues: PayrollImportIssue[] = []
  const terCards = await fetchTerCards(supabase)
  const templateMap = await ensureTemplates(supabase)

  let rowsProcessed = 0
  let employeesUpserted = 0
  let componentsUpserted = 0
  let payrollLinesUpserted = 0
  let mismatchCount = 0
  let sheetsProcessed = 0

  for (const ws of workbook.worksheets) {
    const month = SHEET_MONTH[ws.name.trim().toUpperCase()]
    if (!month) continue
    sheetsProcessed += 1
    const period = { year, month }
    const parsedRows = parseSheetRows(ws, issues)
    if (!parsedRows.length) continue
    let runId = ''
    if (mode === 'commit') runId = await upsertRun(supabase, period, userId)

    for (const row of parsedRows) {
      rowsProcessed += 1
      try {
        const isAbovePtkp = shouldApplyTerMonthly({
          ptkpStatus: row.ptkpStatus,
          grossIncome: row.grossIncome,
        })
        const category = isAbovePtkp ? deriveTerCategory(row.ptkpStatus) : null
        const brackets = category ? terCards.get(category) ?? [] : []
        const terRate = isAbovePtkp ? pickTerRate(brackets, row.grossIncome) : 0
        const pph21System = computePph21System({
          grossIncome: row.grossIncome,
          terRate,
          taxStatus: row.taxStatus,
        })
        const gap = Math.abs(row.pph21Excel - pph21System)
        if (gap > mismatchTolerance) {
          mismatchCount += 1
          issues.push({
            rowNumber: row.rowNumber,
            employeeName: row.fullName,
            level: 'warning',
            message: `Selisih PPh21 di atas toleransi: excel=${row.pph21Excel.toFixed(2)}, system=${pph21System.toFixed(2)}, gap=${gap.toFixed(2)}`,
          })
        }
        if (mode === 'dry-run') continue

        const emp = await upsertEmployee(supabase, row)
        employeesUpserted += 1

        for (const mapping of PAYROLL_COMPONENT_COLUMN_MAP) {
          const amount = row.componentValues[mapping.code] ?? 0
          const tpl = templateMap.get(mapping.code)
          if (!tpl || amount === 0) continue
          const { error } = await supabase.from('employee_salary_component_amounts').upsert(
            {
              employee_id: emp.id,
              template_id: tpl.id,
              amount: amount.toFixed(2),
            },
            { onConflict: 'employee_id,template_id', ignoreDuplicates: false }
          )
          if (error) throw new Error(error.message)
          componentsUpserted += 1
        }

        await upsertPayrollLine({
          supabase,
          runId,
          employeeId: emp.id,
          row,
          terCategory: category,
          terRate,
          pph21System,
        })
        payrollLinesUpserted += 1
      } catch (error) {
        issues.push({
          rowNumber: row.rowNumber,
          employeeName: row.fullName,
          level: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  return {
    mode,
    sheetsProcessed,
    rowsProcessed,
    employeesUpserted,
    componentsUpserted,
    payrollLinesUpserted,
    warnings: issues.filter(i => i.level === 'warning').length,
    errors: issues.filter(i => i.level === 'error').length,
    mismatchCount,
    issues: issues.slice(0, 200),
  }
}
