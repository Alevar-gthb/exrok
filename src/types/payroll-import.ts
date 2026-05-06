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

export type PayrollComponentMapping = {
  header: string
  code: string
  label: string
  autoCreated: boolean
}

export type PayrollImportSummary = {
  mode: PayrollImportMode
  needsProjectConfirmation?: boolean
  unknownProjects?: string[]
  sheetsProcessed: number
  rowsProcessed: number
  employeesUpserted: number
  componentsUpserted: number
  payrollLinesUpserted: number
  warnings: number
  errors: number
  mismatchCount: number
  issues: PayrollImportIssue[]
  componentMappings: PayrollComponentMapping[]
}
