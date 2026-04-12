// ============================================================
// supabase/database.types.ts
// Typed schema untuk Supabase client — dipakai oleh client.ts & server.ts
// ============================================================
/** JSON value untuk return type RPC Supabase */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
import type {
  Employee, EmployeeInsert, EmployeeUpdate,
  Project, ProjectInsert, ProjectUpdate,
  Expense, ExpenseInsert, ExpenseUpdate,
  InventoryItem, InventoryInsert, InventoryUpdate,
  AuditLog,
  ApprovalRule, ApprovalRuleInsert, ApprovalRuleUpdate,
  ExpenseApproval, ExpenseApprovalInsert, ExpenseApprovalUpdate,
  ReimbursementBatch, ReimbursementBatchInsert,
  ReimbursementBatchItem, ReimbursementBatchItemInsert,
  EmployeeContract, EmployeeContractInsert, EmployeeContractUpdate,
  SalaryComponentTemplate,
  SalaryComponentTemplateInsert,
  SalaryComponentTemplateUpdate,
  EmployeeSalaryComponentAmount,
  EmployeeSalaryComponentAmountInsert,
  EmployeeSalaryComponentAmountUpdate,
  EmployeeProjectAssignment,
  EmployeeProjectAssignmentInsert,
  EmployeeProjectAssignmentUpdate,
  PayrollRun, PayrollRunInsert, PayrollRunUpdate,
  PayrollRunLine, PayrollRunLineInsert, PayrollRunLineUpdate,
} from '@/types/database.types'

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: Employee
        Insert: EmployeeInsert
        Update: EmployeeUpdate
      }
      projects: {
        Row: Project
        Insert: ProjectInsert
        Update: ProjectUpdate
      }
      expenses: {
        Row: Expense
        Insert: ExpenseInsert
        Update: ExpenseUpdate
      }
      inventory_items: {
        Row: InventoryItem
        Insert: InventoryInsert
        Update: InventoryUpdate
      }
      audit_logs: {
        Row: AuditLog
        Insert: never  // Audit log hanya ditulis oleh trigger DB
        Update: never
      }
      approval_rules: {
        Row: ApprovalRule
        Insert: ApprovalRuleInsert
        Update: ApprovalRuleUpdate
      }
      expense_approvals: {
        Row: ExpenseApproval
        Insert: ExpenseApprovalInsert
        Update: ExpenseApprovalUpdate
      }
      reimbursement_batches: {
        Row: ReimbursementBatch
        Insert: ReimbursementBatchInsert
        Update: Partial<ReimbursementBatchInsert>
      }
      reimbursement_batch_items: {
        Row: ReimbursementBatchItem
        Insert: ReimbursementBatchItemInsert
        Update: Partial<ReimbursementBatchItemInsert>
      }
      employee_contracts: {
        Row: EmployeeContract
        Insert: EmployeeContractInsert
        Update: EmployeeContractUpdate
      }
      salary_component_templates: {
        Row: SalaryComponentTemplate
        Insert: SalaryComponentTemplateInsert
        Update: SalaryComponentTemplateUpdate
      }
      employee_salary_component_amounts: {
        Row: EmployeeSalaryComponentAmount
        Insert: EmployeeSalaryComponentAmountInsert
        Update: EmployeeSalaryComponentAmountUpdate
      }
      employee_project_assignments: {
        Row: EmployeeProjectAssignment
        Insert: EmployeeProjectAssignmentInsert
        Update: EmployeeProjectAssignmentUpdate
      }
      payroll_runs: {
        Row: PayrollRun
        Insert: PayrollRunInsert
        Update: PayrollRunUpdate
      }
      payroll_run_lines: {
        Row: PayrollRunLine
        Insert: PayrollRunLineInsert
        Update: PayrollRunLineUpdate
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      submit_expense: {
        Args: { p_expense_id: string }
        Returns: Json
      }
      process_approval: {
        Args: {
          p_expense_approval_id: string
          p_action: string
          p_notes?: string | null
        }
        Returns: Json
      }
      bulk_process_approval: {
        Args: {
          p_expense_approval_ids: string[]
          p_action: string
          p_notes?: string | null
        }
        Returns: Json
      }
      create_reimbursement_batch: {
        Args: {
          p_expense_ids: string[]
          p_batch_date: string
          p_payment_method: string
          p_reference_no?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
