-- ============================================================
-- 001_schema.sql — Exrok Database Schema
-- Jalankan PERTAMA di Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MASTER DATA
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    salary_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    role TEXT CHECK (role IN ('owner', 'finance', 'ga', 'staff')) DEFAULT 'staff',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'Active'
);

-- 2. FINANCE
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref_no TEXT UNIQUE,
    transaction_date DATE DEFAULT CURRENT_DATE,
    type TEXT CHECK (type IN ('PO', 'Reimburse', 'Salary')),
    description TEXT,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat NUMERIC(15,2) DEFAULT 0,
    admin_fee NUMERIC(15,2) DEFAULT 0,
    service_fee NUMERIC(15,2) DEFAULT 0,
    total_payment NUMERIC(15,2) GENERATED ALWAYS AS (amount + vat + admin_fee + service_fee) STORED,
    status TEXT DEFAULT 'Draft',
    project_id UUID REFERENCES projects(id),
    employee_id UUID REFERENCES employees(id),
    document_url TEXT,
    is_reconciled BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INVENTORY
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_barang TEXT UNIQUE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('Asset', 'Consumable')),
    location TEXT,
    condition TEXT,
    purchase_price NUMERIC(15,2),
    expense_id UUID REFERENCES expenses(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
