import ExcelJS from 'exceljs'
import { PAYROLL_PROJECT_LIST_HEADER, PAYROLL_REQUIRED_HEADERS } from '@/lib/payroll-import/mapping'
import { computePph21System, deriveTerCategory, pickTerRate, shouldApplyTerMonthly } from '@/lib/payroll-import/ter'
import type {
  PayrollComponentMapping,
  PayrollImportIssue,
  PayrollImportMode,
  PayrollImportSummary,
} from '@/types/payroll-import'

type SheetPeriod = { year: number; month: number }

type ComponentTemplate = {
  id: string
  code: string
  label: string
  kind: 'earning' | 'deduction'
  excelAliases: string[]
}

type ComponentMap = {
  byNormalizedHeader: Map<string, ComponentTemplate>
  byCode: Map<string, ComponentTemplate>
}

type ParsedRow = {
  rowNumber: number
  npwp: string | null
  nip: string | null
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
  projectNames: string[]
}

type ProjectLookup = Map<string, { id: string; name: string }>

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

/**
 * Header yang dipakai untuk metadata baris (identitas, gross, tax) dan tidak
 * pernah menjadi komponen gaji. Header lain di `PAYROLL_REQUIRED_HEADERS`
 * (mis. "PPh 21") tetap boleh juga dipetakan sebagai komponen via alias.
 */
const NON_COMPONENT_HEADERS_NORMALIZED = new Set<string>(
  [
    'NPWP',
    'NIP',
    'Nama Pegawai',
    'Status Pajak',
    'Status PTKP',
    'Penghasilan Bruto',
    'Kategori TER',
    'TER',
    'THP',
    'Transfer',
    PAYROLL_PROJECT_LIST_HEADER,
  ].map(h => normalizeHeader(h))
)

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

function normalizeProjectName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeFullName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeNpwp(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

function headerToCode(header: string): string {
  const cleaned = header
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
  return cleaned.slice(0, 64)
}

function headersFromRow(row: ExcelJS.Row): Record<string, number> {
  const map: Record<string, number> = {}
  row.eachCell((cell, colNumber) => {
    const h = toText(readCellValue(cell.value))
    if (h) map[h] = colNumber
  })
  return map
}

function emptyComponentMap(): ComponentMap {
  return { byNormalizedHeader: new Map(), byCode: new Map() }
}

function indexComponent(map: ComponentMap, tpl: ComponentTemplate) {
  map.byCode.set(tpl.code, tpl)
  const keys = new Set<string>()
  keys.add(normalizeHeader(tpl.code))
  keys.add(normalizeHeader(tpl.label))
  for (const alias of tpl.excelAliases) {
    if (alias) keys.add(normalizeHeader(alias))
  }
  for (const key of keys) {
    if (!key) continue
    if (!map.byNormalizedHeader.has(key)) {
      map.byNormalizedHeader.set(key, tpl)
    }
  }
}

async function loadComponentMap(supabase: any): Promise<ComponentMap> {
  const { data, error } = await supabase
    .from('salary_component_templates')
    .select('id, code, label, kind, excel_aliases')
  if (error) throw new Error(error.message)
  const map = emptyComponentMap()
  for (const row of data ?? []) {
    const aliases = Array.isArray(row.excel_aliases) ? (row.excel_aliases as string[]) : []
    indexComponent(map, {
      id: row.id,
      code: row.code,
      label: row.label,
      kind: row.kind === 'deduction' ? 'deduction' : 'earning',
      excelAliases: aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0),
    })
  }
  return map
}

function parseSheetRows(
  ws: ExcelJS.Worksheet,
  issues: PayrollImportIssue[],
  componentMap: ComponentMap,
  unknownHeaders: Map<string, string>
): ParsedRow[] {
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

  const componentColumns: Array<{ header: string; column: number; code: string | null }> = []
  for (const [header, column] of Object.entries(headerMap)) {
    const normalized = normalizeHeader(header)
    if (!normalized) continue
    if (NON_COMPONENT_HEADERS_NORMALIZED.has(normalized)) continue
    const tpl = componentMap.byNormalizedHeader.get(normalized)
    if (tpl) {
      componentColumns.push({ header, column, code: tpl.code })
    } else {
      componentColumns.push({ header, column, code: null })
      if (!unknownHeaders.has(normalized)) {
        unknownHeaders.set(normalized, header.replace(/\s+/g, ' ').trim())
      }
    }
  }

  const parsed: ParsedRow[] = []
  for (let i = 2; i <= ws.rowCount; i += 1) {
    const row = ws.getRow(i)
    const fullName = toText(readCellValue(row.getCell(headerMap['Nama Pegawai']).value))
    if (!fullName) continue
    const npwpRaw = toText(readCellValue(row.getCell(headerMap['NPWP']).value))
    const npwp = npwpRaw ? normalizeNpwp(npwpRaw) : null
    const nip = headerMap['NIP'] ? toText(readCellValue(row.getCell(headerMap['NIP']).value)) || null : null
    const grossIncome = toNumber(readCellValue(row.getCell(headerMap['Penghasilan Bruto']).value))
    const componentValues: Record<string, number> = {}
    for (const comp of componentColumns) {
      if (!comp.code) continue
      const value = toNumber(readCellValue(row.getCell(comp.column).value))
      const prev = componentValues[comp.code] ?? 0
      componentValues[comp.code] = prev + value
    }
    const projectListColumn = headerMap[PAYROLL_PROJECT_LIST_HEADER]
    const projectListRaw = projectListColumn ? toText(readCellValue(row.getCell(projectListColumn).value)) : ''
    const projectNames = projectListRaw
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .filter((name, idx, arr) => arr.findIndex(other => normalizeProjectName(other) === normalizeProjectName(name)) === idx)
    parsed.push({
      rowNumber: i,
      npwp,
      nip,
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
      projectNames,
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

async function autoCreateMissingTemplates(params: {
  supabase: any
  unknownHeaders: Map<string, string>
  componentMap: ComponentMap
  trackMappings: PayrollComponentMapping[]
}): Promise<number> {
  const { supabase, unknownHeaders, componentMap, trackMappings } = params
  if (!unknownHeaders.size) return 0
  const inserts: Array<{
    code: string
    label: string
    kind: 'earning' | 'deduction'
    is_active: boolean
    include_in_monthly_payroll: boolean
    excel_aliases: string[]
    sourceHeader: string
  }> = []
  const usedCodes = new Set<string>(componentMap.byCode.keys())
  for (const [, header] of unknownHeaders) {
    const baseCode = headerToCode(header) || `KOMPONEN_${usedCodes.size + 1}`
    let code = baseCode
    let suffix = 2
    while (usedCodes.has(code)) {
      code = `${baseCode}_${suffix}`
      suffix += 1
    }
    usedCodes.add(code)
    inserts.push({
      code,
      label: header,
      kind: 'earning',
      is_active: true,
      include_in_monthly_payroll: true,
      excel_aliases: [header],
      sourceHeader: header,
    })
  }

  const { data, error } = await supabase
    .from('salary_component_templates')
    .insert(inserts.map(({ sourceHeader: _ignored, ...payload }) => payload))
    .select('id, code, label, kind, excel_aliases')
  if (error) throw new Error(error.message)

  for (let idx = 0; idx < (data ?? []).length; idx += 1) {
    const row = data![idx]
    const sourceHeader = inserts[idx]?.sourceHeader ?? row.label
    const aliases = Array.isArray(row.excel_aliases) ? (row.excel_aliases as string[]) : []
    const tpl: ComponentTemplate = {
      id: row.id,
      code: row.code,
      label: row.label,
      kind: row.kind === 'deduction' ? 'deduction' : 'earning',
      excelAliases: aliases.filter((a): a is string => typeof a === 'string' && a.length > 0),
    }
    indexComponent(componentMap, tpl)
    trackMappings.push({ header: sourceHeader, code: tpl.code, label: tpl.label, autoCreated: true })
  }
  return inserts.length
}

function buildMatchedMappings(params: {
  workbook: ExcelJS.Workbook
  componentMap: ComponentMap
}): PayrollComponentMapping[] {
  const { workbook, componentMap } = params
  const seen = new Set<string>()
  const out: PayrollComponentMapping[] = []
  for (const ws of workbook.worksheets) {
    const month = SHEET_MONTH[ws.name.trim().toUpperCase()]
    if (!month) continue
    const headerMap = headersFromRow(ws.getRow(1))
    for (const header of Object.keys(headerMap)) {
      const normalized = normalizeHeader(header)
      if (!normalized || NON_COMPONENT_HEADERS_NORMALIZED.has(normalized)) continue
      if (seen.has(normalized)) continue
      const tpl = componentMap.byNormalizedHeader.get(normalized)
      if (!tpl) continue
      seen.add(normalized)
      out.push({
        header: header.replace(/\s+/g, ' ').trim(),
        code: tpl.code,
        label: tpl.label,
        autoCreated: false,
      })
    }
  }
  return out
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
  if (row.nip) {
    const { data: e2 } = await supabase.from('employees').select('id').eq('nip', row.nip).maybeSingle()
    if (e2) {
      const { error } = await supabase
        .from('employees')
        .update({ full_name: row.fullName, tax_status: row.taxStatus, ptkp_status: row.ptkpStatus, status: 'Active' })
        .eq('id', e2.id)
      if (error) throw new Error(error.message)
      return { id: e2.id }
    }
  }
  const normalizedName = normalizeFullName(row.fullName)
  const { data: byName, error: byNameError } = await supabase
    .from('employees')
    .select('id, full_name')
    .ilike('full_name', row.fullName)
  if (byNameError) throw new Error(byNameError.message)
  const nameMatches = (byName ?? []).filter((candidate: { full_name: string | null }) => normalizeFullName(candidate.full_name ?? '') === normalizedName)
  if (nameMatches.length > 1) {
    throw new Error(`Nama karyawan ambigu (${row.fullName}) terdeteksi lebih dari satu record. Rapikan master employee dulu.`)
  }
  if (nameMatches.length === 1) {
    const target = nameMatches[0]
    const { error } = await supabase
      .from('employees')
      .update({
        full_name: row.fullName,
        npwp: row.npwp ?? undefined,
        tax_status: row.taxStatus,
        ptkp_status: row.ptkpStatus,
        status: 'Active',
      })
      .eq('id', target.id)
    if (error) throw new Error(error.message)
    return { id: target.id }
  }

  const { data: ins, error: insErr } = await supabase
    .from('employees')
    .insert({
      full_name: row.fullName,
      npwp: row.npwp,
      nip: row.nip,
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

async function replacePayrollLinesForEmployee(params: {
  supabase: any
  runId: string
  employeeId: string
  row: ParsedRow
  projectIds: Array<string | null>
  terCategory: string | null
  terRate: number
  pph21System: number
}) {
  const { supabase, runId, employeeId, row, projectIds, terCategory, terRate, pph21System } = params
  const pph21Gap = row.pph21Excel - pph21System
  const amount = row.transferExcel || row.thpExcel || row.grossIncome - row.pph21Excel

  const { error: deleteErr } = await supabase.from('payroll_run_lines').delete().eq('run_id', runId).eq('employee_id', employeeId)
  if (deleteErr) throw new Error(deleteErr.message)

  const payloads = projectIds.map(projectId => ({
    run_id: runId,
    employee_id: employeeId,
    project_id: projectId,
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
      project_list_excel: row.projectNames,
      components: row.componentValues,
    },
  }))

  const { error } = await supabase.from('payroll_run_lines').insert(payloads)
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

async function fetchProjectLookup(supabase: any): Promise<ProjectLookup> {
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throw new Error(error.message)
  const out: ProjectLookup = new Map()
  for (const row of data ?? []) {
    const name = toText(row.name)
    if (!name) continue
    out.set(normalizeProjectName(name), { id: row.id, name })
  }
  return out
}

function collectUnknownProjects(rows: ParsedRow[], projectsByName: ProjectLookup): string[] {
  const out = new Map<string, string>()
  for (const row of rows) {
    for (const name of row.projectNames) {
      const key = normalizeProjectName(name)
      if (!key || projectsByName.has(key) || out.has(key)) continue
      out.set(key, name.trim().replace(/\s+/g, ' '))
    }
  }
  return [...out.values()]
}

async function createMissingProjects(params: { supabase: any; unknownProjects: string[] }) {
  const { supabase, unknownProjects } = params
  if (!unknownProjects.length) return
  const refreshed = await fetchProjectLookup(supabase)
  const toInsert = unknownProjects
    .map(name => name.trim().replace(/\s+/g, ' '))
    .filter(name => name && !refreshed.has(normalizeProjectName(name)))
  if (!toInsert.length) return
  const { error } = await supabase.from('projects').insert(
    toInsert.map(name => ({
      name,
      client_name: null,
      status: 'Active',
    }))
  )
  if (error) throw new Error(error.message)
}

export async function importPayrollWorkbook(params: {
  supabase: any
  fileBuffer: any
  mode: PayrollImportMode
  autoCreateProjects?: boolean
  year: number
  userId: string | null
  mismatchTolerance: number
  onProgress?: (payload: {
    status: 'running' | 'completed' | 'failed'
    stage: string
    message?: string
    sheetsProcessed: number
    rowsProcessed: number
    employeesUpserted: number
    componentsUpserted: number
    payrollLinesUpserted: number
    mismatchCount: number
    warnings: number
    errors: number
  }) => Promise<void> | void
}): Promise<PayrollImportSummary> {
  const { supabase, fileBuffer, mode, autoCreateProjects, year, userId, mismatchTolerance, onProgress } = params
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer as any)
  const issues: PayrollImportIssue[] = []
  const terCards = await fetchTerCards(supabase)
  const componentMap = await loadComponentMap(supabase)
  let projectsByName = await fetchProjectLookup(supabase)

  let rowsProcessed = 0
  let employeesUpserted = 0
  let componentsUpserted = 0
  let payrollLinesUpserted = 0
  let mismatchCount = 0
  let sheetsProcessed = 0
  const componentMappings: PayrollComponentMapping[] = []
  const publishProgress = async (status: 'running' | 'completed' | 'failed', stage: string, message?: string) => {
    if (!onProgress) return
    await onProgress({
      status,
      stage,
      message,
      sheetsProcessed,
      rowsProcessed,
      employeesUpserted,
      componentsUpserted,
      payrollLinesUpserted,
      mismatchCount,
      warnings: issues.filter(i => i.level === 'warning').length,
      errors: issues.filter(i => i.level === 'error').length,
    })
  }

  await publishProgress('running', 'workbook_loaded', 'Workbook berhasil dibaca')

  const unknownHeaders = new Map<string, string>()
  const rowsPerSheet = new Map<string, ParsedRow[]>()
  for (const ws of workbook.worksheets) {
    const month = SHEET_MONTH[ws.name.trim().toUpperCase()]
    if (!month) continue
    const parsedRows = parseSheetRows(ws, issues, componentMap, unknownHeaders)
    rowsPerSheet.set(ws.name, parsedRows)
  }

  if (mode === 'commit' && unknownHeaders.size) {
    await autoCreateMissingTemplates({ supabase, unknownHeaders, componentMap, trackMappings: componentMappings })
    // Re-populate componentValues untuk header yang baru dikenali setelah auto-create.
    for (const ws of workbook.worksheets) {
      const month = SHEET_MONTH[ws.name.trim().toUpperCase()]
      if (!month) continue
      const headerMap = headersFromRow(ws.getRow(1))
      const newlyMappedColumns: Array<{ column: number; code: string }> = []
      for (const [header, column] of Object.entries(headerMap)) {
        const normalized = normalizeHeader(header)
        if (!normalized || NON_COMPONENT_HEADERS_NORMALIZED.has(normalized)) continue
        if (!unknownHeaders.has(normalized)) continue
        const tpl = componentMap.byNormalizedHeader.get(normalized)
        if (!tpl) continue
        newlyMappedColumns.push({ column, code: tpl.code })
      }
      if (!newlyMappedColumns.length) continue
      const parsedRows = rowsPerSheet.get(ws.name) ?? []
      for (const parsed of parsedRows) {
        const row = ws.getRow(parsed.rowNumber)
        for (const t of newlyMappedColumns) {
          const value = toNumber(readCellValue(row.getCell(t.column).value))
          parsed.componentValues[t.code] = (parsed.componentValues[t.code] ?? 0) + value
        }
      }
    }
  } else if (mode === 'dry-run' && unknownHeaders.size) {
    for (const [, header] of unknownHeaders) {
      issues.push({
        rowNumber: 1,
        employeeName: '-',
        level: 'warning',
        message: `Header "${header}" belum dipetakan ke komponen master. Komponen baru akan otomatis dibuat saat commit.`,
      })
      componentMappings.push({ header, code: '(akan dibuat)', label: header, autoCreated: true })
    }
  }

  for (const matched of buildMatchedMappings({ workbook, componentMap })) {
    if (componentMappings.some(m => m.code === matched.code && m.header === matched.header)) continue
    componentMappings.push(matched)
  }

  const allRows = [...rowsPerSheet.values()].flat()
  const unknownProjects = collectUnknownProjects(allRows, projectsByName)
  if (mode === 'commit' && unknownProjects.length && !autoCreateProjects) {
    await publishProgress('completed', 'awaiting_project_confirmation', 'Butuh konfirmasi tambah project baru')
    return {
      mode,
      needsProjectConfirmation: true,
      unknownProjects,
      sheetsProcessed: 0,
      rowsProcessed: 0,
      employeesUpserted: 0,
      componentsUpserted: 0,
      payrollLinesUpserted: 0,
      warnings: issues.filter(i => i.level === 'warning').length,
      errors: issues.filter(i => i.level === 'error').length,
      mismatchCount: 0,
      issues: issues.slice(0, 200),
      componentMappings,
    }
  }
  if (mode === 'commit' && unknownProjects.length && autoCreateProjects) {
    await createMissingProjects({ supabase, unknownProjects })
    projectsByName = await fetchProjectLookup(supabase)
  }

  for (const ws of workbook.worksheets) {
    const month = SHEET_MONTH[ws.name.trim().toUpperCase()]
    if (!month) continue
    sheetsProcessed += 1
    await publishProgress('running', 'sheet_processing', `Memproses sheet ${ws.name}`)
    const period = { year, month }
    const parsedRows = rowsPerSheet.get(ws.name) ?? []
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

        const invalidProjectNames = row.projectNames.filter(name => !projectsByName.has(normalizeProjectName(name)))
        if (invalidProjectNames.length) {
          issues.push({
            rowNumber: row.rowNumber,
            employeeName: row.fullName,
            level: 'error',
            message: `Project tidak ditemukan: ${invalidProjectNames.join(', ')}`,
          })
          continue
        }
        if (mode === 'dry-run') continue
        const projectIds = row.projectNames.length
          ? row.projectNames
              .map(name => projectsByName.get(normalizeProjectName(name))?.id ?? null)
              .filter((id): id is string => Boolean(id))
          : [null]

        const emp = await upsertEmployee(supabase, row)
        employeesUpserted += 1

        for (const [code, amount] of Object.entries(row.componentValues)) {
          const tpl = componentMap.byCode.get(code)
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

        await replacePayrollLinesForEmployee({
          supabase,
          runId,
          employeeId: emp.id,
          row,
          projectIds,
          terCategory: category,
          terRate,
          pph21System,
        })
        payrollLinesUpserted += projectIds.length
      } catch (error) {
        issues.push({
          rowNumber: row.rowNumber,
          employeeName: row.fullName,
          level: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      if (rowsProcessed % 25 === 0) {
        await publishProgress('running', 'rows_processing', `Baris diproses: ${rowsProcessed}`)
      }
    }
  }

  await publishProgress('completed', 'completed', 'Import payroll selesai')

  return {
    mode,
    needsProjectConfirmation: false,
    unknownProjects,
    sheetsProcessed,
    rowsProcessed,
    employeesUpserted,
    componentsUpserted,
    payrollLinesUpserted,
    warnings: issues.filter(i => i.level === 'warning').length,
    errors: issues.filter(i => i.level === 'error').length,
    mismatchCount,
    issues: issues.slice(0, 200),
    componentMappings,
  }
}
