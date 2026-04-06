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
export type ExpenseStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'
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
  created_at: string          // TIMESTAMPTZ → ISO string
}

export type EmployeeInsert = Omit<Employee, 'id' | 'created_at'>
export type EmployeeUpdate = Partial<EmployeeInsert>

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
  document_url: string | null
  is_reconciled: boolean
  created_by: string | null   // UUID → auth.users.id
  created_at: string
}

// Insert tidak menyertakan `total_payment` (Generated Column di DB)
export type ExpenseInsert = Omit<Expense, 'id' | 'total_payment' | 'created_at'>
export type ExpenseUpdate = Partial<ExpenseInsert>

// Expense dengan relasi JOIN (untuk tampilan di tabel)
export interface ExpenseWithRelations extends Expense {
  project: Pick<Project, 'id' | 'name'> | null
  employee: Pick<Employee, 'id' | 'full_name'> | null
}

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
