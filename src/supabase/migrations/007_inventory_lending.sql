-- ============================================================
-- 007_inventory_lending.sql
-- Tambah: serial_number, initial_stock, last_stock ke inventory_items
-- Buat: tabel item_loans (lending system)
-- ============================================================

-- ─── Kolom baru di inventory_items ───────────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS initial_stock INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stock INTEGER DEFAULT 0;

-- ─── Tabel lending system ────────────────────────────────────
CREATE TABLE item_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date DATE,
  condition_on_loan TEXT DEFAULT 'Baik',
  condition_on_return TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Returned', 'Overdue')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS untuk item_loans
ALTER TABLE item_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_select_privileged"
ON item_loans FOR SELECT
USING (get_my_role() IN ('owner', 'ga', 'finance'));

CREATE POLICY "loans_select_own"
ON item_loans FOR SELECT
USING (get_my_role() = 'staff' AND employee_id = (
  SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
));

CREATE POLICY "loans_insert"
ON item_loans FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'ga'));

CREATE POLICY "loans_update"
ON item_loans FOR UPDATE
USING (get_my_role() IN ('owner', 'ga'));

-- Audit trigger untuk item_loans
CREATE TRIGGER trg_audit_loans
AFTER INSERT OR UPDATE OR DELETE ON item_loans
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
