// ============================================================
// DATABASE TYPES — Auto-generated from ERD Schema
// Roketin & Spacehub — Integrated Expense & Inventory System
// IMPORTANT: Semua nominal keuangan menggunakan `string` bukan
// `number` untuk mencegah floating-point error pada JS.
// Di database, kolom ini bertipe NUMERIC(15,2).
// ============================================================

export type UserRole = 'owner' | 'finance' | 'ga' | 'staff'
export type EmployeeStatus = 'Active' | 'Inactive'
export type ProjectStatus = 'Active' | 'Completed' | 'On Hold'
export type ExpenseType = 'PO' | 'Reimburse' | 'Salary'
export type ExpenseStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Paid'
export type InventoryType = 'Asset' | 'Consumable'
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

// ─── 1. MASTER DATA ──────────────────────────────────────────

export interface Employee {
  id: string                  // UUID
  full_name: string
  email: string | null
  salary_amount: string       // NUMERIC(15,2) → string untuk presisi
  role: UserRole
  status: EmployeeStatus
  /** Nomor induk pekerja internal (diisi otomatis oleh DB jika kosong). */
  nip: string | null
  /** Jabatan / posisi pekerjaan. */
  job_title: string | null
  /** Jika true, modul kontrak/perpanjangan tidak diperlukan (karyawan tetap). */
  is_permanent: boolean
  /** Nomor NPWP (opsional). */
  npwp: string | null
  /** Status pajak pada payroll import: Gross/Net. */
  tax_status: 'Gross' | 'Net' | null
  /** Status PTKP seperti TK/0, K/1, dst. */
  ptkp_status: string | null
  created_at: string          // TIMESTAMPTZ → ISO string
}

export type EmployeeInsert = Omit<Employee, 'id' | 'created_at'>
export type EmployeeUpdate = Partial<EmployeeInsert>

/** Dropdown expense — tanpa gaji pokok (HR mengatur komponen di menu Karyawan). */
export type ExpenseFormEmployee = Pick<Employee, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'created_at' | 'nip' | 'job_title'>

// ─────────────────────────────────────────────────────────────

export interface Project {
  id: string                  // UUID
  name: string
  client_name: string | null
  status: ProjectStatus
}

export type ProjectInsert = Omit<Project, 'id'>
export type ProjectUpdate = Partial<ProjectInsert>

// ─── 2. FINANCE ──────────────────────────────────────────────

export interface Expense {
  id: string                  // UUID
  ref_no: string | null
  submission_date: string     // DATE tanggal pengajuan
  transaction_date: string    // DATE → ISO string "YYYY-MM-DD"
  type: ExpenseType
  description: string | null
  // Breakdown biaya — semua string untuk keamanan presisi desimal
  amount: string              // DPP (Dasar Pengenaan Pajak)
  vat: string                 // PPN
  admin_fee: string           // Biaya Admin
  service_fee: string         // Biaya Service
  total_payment: string       // Generated Column: amount + vat + admin_fee + service_fee
  status: ExpenseStatus
  project_id: string | null   // FK → projects.id
  employee_id: string | null  // FK → employees.id
  category_id: string | null
  subcategory_id: string | null
  vendor_id: string | null
  business_unit: 'RKT' | 'SPH' | null
  department: 'Technology' | 'Operation' | 'Sales' | 'Human Capital' | null
  payment_method: string | null
  due_date: string | null
  payment_date: string | null
  /** Bukti bayar (PDF/JPG/PNG) setelah ditandai Paid */
  payment_proof_url: string | null
  reimbursement_batch_id: string | null
  document_url: string | null
  is_reconciled: boolean
  /** Setelah migration OCR di Supabase. */
  ocr_scanned?: boolean | null
  ocr_confidence?: number | null
  ocr_scanned_at?: string | null
  created_by: string | null   // UUID → auth.users.id
  created_at: string
  updated_at: string
}

// Insert tidak menyertakan `total_payment` (Generated Column di DB). Bukti bayar hanya setelah Paid.
export type ExpenseInsert = Omit<Expense, 'id' | 'total_payment' | 'created_at' | 'updated_at' | 'payment_proof_url'> & {
  payment_proof_url?: string | null
}
export type ExpenseUpdate = Partial<ExpenseInsert>

// Expense dengan relasi JOIN (untuk tampilan di tabel)
export interface ExpenseWithRelations extends Expense {
  project: Pick<Project, 'id' | 'name'> | null
  employee: Pick<Employee, 'id' | 'full_name'> | null
}

// ─── APPROVAL ────────────────────────────────────────────────

export interface ApprovalRule {
  id: string
  name: string
  business_unit: 'RKT' | 'SPH' | null
  expense_type: ExpenseType | null
  /** Non-empty: hanya cocok jika payment_method expense sama persis dengan salah satu nilai. */
  payment_methods: string[] | null
  /** Non-empty: expense dengan metode ini tidak cocok (mis. kecuali Petty Cash). */
  excluded_payment_methods: string[] | null
  min_amount: string
  max_amount: string | null
  require_approval: boolean
  approver_employee_id: string | null
  priority: number
  is_active: boolean
  created_by: string | null
  created_at: string
}

export type ApprovalRuleInsert = Omit<ApprovalRule, 'id' | 'created_at'>
export type ApprovalRuleUpdate = Partial<ApprovalRuleInsert>

export type ExpenseApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export interface ExpenseApproval {
  id: string
  expense_id: string
  approval_rule_id: string | null
  approver_employee_id: string | null
  status: ExpenseApprovalStatus
  notes: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type ExpenseApprovalInsert = Omit<ExpenseApproval, 'id' | 'created_at' | 'updated_at'>
export type ExpenseApprovalUpdate = Partial<ExpenseApprovalInsert>

// ─── REIMBURSEMENT BATCHES ───────────────────────────────────

export interface ReimbursementBatch {
  id: string
  batch_no: string
  batch_date: string
  payment_method: string | null
  reference_no: string | null
  notes: string | null
  total_amount: string
  created_by: string | null
  created_at: string
}

export type ReimbursementBatchInsert = Omit<ReimbursementBatch, 'id' | 'created_at'>

export interface ReimbursementBatchItem {
  id: string
  batch_id: string
  expense_id: string
  amount_paid: string
  created_at: string
}

export type ReimbursementBatchItemInsert = Omit<ReimbursementBatchItem, 'id' | 'created_at'>

// ─── HR & PAYROLL ────────────────────────────────────────────

export interface EmployeeContract {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  replaces_contract_id: string | null
  notes: string | null
  created_at: string
}

export type EmployeeContractInsert = Omit<EmployeeContract, 'id' | 'created_at'>
export type EmployeeContractUpdate = Partial<EmployeeContractInsert>

export type CompensationKind = 'earning' | 'deduction'

/** Master komponen gaji (dipilih per karyawan + nominal). */
export interface SalaryComponentTemplate {
  id: string
  code: string
  label: string
  kind: CompensationKind
  is_active: boolean
  /** false = tidak masuk ringkasan gaji bulanan (mis. THR). */
  include_in_monthly_payroll: boolean
  created_at: string
}

export type SalaryComponentTemplateInsert = Omit<SalaryComponentTemplate, 'id' | 'created_at'>
export type SalaryComponentTemplateUpdate = Partial<SalaryComponentTemplateInsert>

/** Nominal komponen per karyawan (referensi ke master). */
export interface EmployeeSalaryComponentAmount {
  id: string
  employee_id: string
  template_id: string
  amount: string
  created_at: string
}

export type EmployeeSalaryComponentAmountInsert = Omit<EmployeeSalaryComponentAmount, 'id' | 'created_at'>
export type EmployeeSalaryComponentAmountUpdate = Partial<
  Pick<EmployeeSalaryComponentAmount, 'amount' | 'template_id'>
>

export interface EmployeeProjectAssignment {
  id: string
  employee_id: string
  project_id: string
  is_primary: boolean
  started_on: string
  ended_on: string | null
  created_at: string
}

export type EmployeeProjectAssignmentInsert = Omit<EmployeeProjectAssignment, 'id' | 'created_at'>
export type EmployeeProjectAssignmentUpdate = Partial<EmployeeProjectAssignmentInsert>

export type PayrollRunStatus = 'draft' | 'submitted'

export interface PayrollRun {
  id: string
  period_year: number
  period_month: number
  status: PayrollRunStatus
  created_by: string | null
  created_at: string
}

export type PayrollRunInsert = Omit<PayrollRun, 'id' | 'created_at'>
export type PayrollRunUpdate = Partial<Pick<PayrollRun, 'status'>>

export type PayrollLineAdjustmentKind = 'earning' | 'deduction'

/** Baris penyesuaian payroll (lembur, bonus, potongan, dll.) */
export interface PayrollLineAdjustment {
  code: string
  label: string
  kind: PayrollLineAdjustmentKind
  amount: string
}

export interface PayrollRunLine {
  id: string
  run_id: string
  employee_id: string
  project_id: string | null
  amount: string
  base_amount: string | null
  adjustments: PayrollLineAdjustment[]
  components_snapshot: Record<string, unknown> | null
  gross_income: string | null
  ter_category: 'A' | 'B' | 'C' | null
  ter_rate: string | null
  pph21_excel: string | null
  pph21_system: string | null
  pph21_gap: string | null
  expense_id: string | null
  created_at: string
}

export type PayrollRunLineInsert = Omit<PayrollRunLine, 'id' | 'created_at'>
export type PayrollRunLineUpdate = Partial<
  Pick<
    PayrollRunLine,
    | 'project_id'
    | 'amount'
    | 'base_amount'
    | 'adjustments'
    | 'components_snapshot'
    | 'gross_income'
    | 'ter_category'
    | 'ter_rate'
    | 'pph21_excel'
    | 'pph21_system'
    | 'pph21_gap'
    | 'expense_id'
  >
>

export interface PayrollTerRateCard {
  id: string
  category: 'A' | 'B' | 'C'
  brackets: Array<{ max: number; rate: number }>
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PayrollTerRateCardInsert = Omit<PayrollTerRateCard, 'id' | 'created_at' | 'updated_at'>
export type PayrollTerRateCardUpdate = Partial<Pick<PayrollTerRateCard, 'brackets' | 'is_active'>>

// ─── 3. INVENTORY ────────────────────────────────────────────

export interface InventoryItem {
  id: string                  // UUID
  kode_barang: string | null
  name: string
  type: InventoryType
  location: string | null
  condition: string | null
  purchase_price: string | null  // NUMERIC(15,2) → string
  expense_id: string | null      // FK → expenses.id (link ke PO pembelian)
  created_at: string
}

export type InventoryInsert = Omit<InventoryItem, 'id' | 'created_at'>
export type InventoryUpdate = Partial<InventoryInsert>

// ─── 4. AUDIT LOGS ───────────────────────────────────────────

export interface AuditLog {
  id: string                  // UUID
  table_name: string
  record_id: string           // UUID dari record yang diubah
  action: AuditAction
  old_data: Record<string, unknown> | null  // JSONB
  new_data: Record<string, unknown> | null  // JSONB
  user_id: string | null
  created_at: string
}

// ─── 5. UTILITY TYPES ────────────────────────────────────────

// Tipe generik untuk response dari Supabase
export interface DbResult<T> {
  data: T | null
  error: string | null
}

export interface DbResultList<T> {
  data: T[]
  error: string | null
  count: number | null
}

// Helper: konversi string DB ke Decimal-safe number untuk kalkulasi
// Gunakan library `decimal.js` atau `dinero.js` untuk operasi aritmatika
export type DecimalString = string & { readonly __brand: 'DecimalString' }
