// ============================================================
// supabase/database.types.ts
// Typed schema untuk Supabase client — dipakai oleh client.ts & server.ts
// ============================================================
import type {
  Employee, EmployeeInsert, EmployeeUpdate,
  Project, ProjectInsert, ProjectUpdate,
  Expense, ExpenseInsert, ExpenseUpdate,
  InventoryItem, InventoryInsert, InventoryUpdate,
  AuditLog,
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
