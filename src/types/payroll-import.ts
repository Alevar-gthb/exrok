export type PayrollImportMode = 'dry-run' | 'commit'

export type PayrollSheetPayload = {
  month: number
  year: number
}

export type PayrollImportIssueLevel = 'warning' | 'error'

export type PayrollImportIssue = {
  rowNumber: number
  employeeName: string
  level: PayrollImportIssueLevel
  message: string
}

export type PayrollImportSummary = {
  mode: PayrollImportMode
  sheetsProcessed: number
  rowsProcessed: number
  employeesUpserted: number
  componentsUpserted: number
  payrollLinesUpserted: number
  warnings: number
  errors: number
  mismatchCount: number
  issues: PayrollImportIssue[]
}
