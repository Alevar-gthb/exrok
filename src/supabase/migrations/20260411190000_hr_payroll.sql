-- ============================================================
-- 20260411190000_hr_payroll.sql — HR master data & payroll runs
-- Jalankan di Supabase SQL Editor lalu reload schema (atau tunggu cache refresh)
-- agar PostgREST mengenali tabel employee_contracts & employee_compensation_components.
-- ============================================================

-- ─── 1. employee_contracts (riwayat kontrak & perpanjangan) ───

CREATE TABLE employee_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  replaces_contract_id uuid REFERENCES employee_contracts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_contracts_employee_id ON employee_contracts(employee_id);

-- ─── 2. employee_compensation_components ─────────────────────

CREATE TABLE employee_compensation_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  amount numeric(15, 2) NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('earning', 'deduction')),
  sort_order integer NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, code)
);

CREATE INDEX idx_employee_compensation_employee_id ON employee_compensation_components(employee_id);

-- ─── 3. employee_project_assignments ──────────────────────────

CREATE TABLE employee_project_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_project_assignments_employee ON employee_project_assignments(employee_id);
CREATE INDEX idx_employee_project_assignments_project ON employee_project_assignments(project_id);

-- ─── 4. payroll_runs & payroll_run_lines ───────────────────────

CREATE TABLE payroll_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month)
);

CREATE TABLE payroll_run_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  amount numeric(15, 2) NOT NULL DEFAULT 0,
  base_amount numeric(15, 2),
  adjustments jsonb NOT NULL DEFAULT '[]'::jsonb,
  components_snapshot jsonb,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id)
);

CREATE INDEX idx_payroll_run_lines_run_id ON payroll_run_lines(run_id);
CREATE INDEX idx_payroll_run_lines_employee_id ON payroll_run_lines(employee_id);

-- ─── 5. Backfill komponen BASE dari salary_amount ──────────────

INSERT INTO employee_compensation_components (employee_id, code, label, amount, kind, sort_order, effective_from)
SELECT e.id, 'BASE', 'Gaji pokok', e.salary_amount, 'earning', 0, CURRENT_DATE
FROM employees e
ON CONFLICT (employee_id, code) DO NOTHING;

-- ─── 6. RLS ───────────────────────────────────────────────────

ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_compensation_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_contracts_select_privileged"
ON employee_contracts FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_contracts_insert_privileged"
ON employee_contracts FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_contracts_update_privileged"
ON employee_contracts FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_contracts_delete_owner"
ON employee_contracts FOR DELETE
USING (get_my_role() = 'owner');

CREATE POLICY "employee_compensation_select_privileged"
ON employee_compensation_components FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_compensation_insert_privileged"
ON employee_compensation_components FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_compensation_update_privileged"
ON employee_compensation_components FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_compensation_delete_owner"
ON employee_compensation_components FOR DELETE
USING (get_my_role() = 'owner');

CREATE POLICY "employee_project_assignments_select_privileged"
ON employee_project_assignments FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_project_assignments_insert_privileged"
ON employee_project_assignments FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_project_assignments_update_privileged"
ON employee_project_assignments FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_project_assignments_delete_owner"
ON employee_project_assignments FOR DELETE
USING (get_my_role() = 'owner');

CREATE POLICY "payroll_runs_select_privileged"
ON payroll_runs FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_runs_insert_privileged"
ON payroll_runs FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_runs_update_privileged"
ON payroll_runs FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_runs_delete_owner"
ON payroll_runs FOR DELETE
USING (get_my_role() = 'owner');

CREATE POLICY "payroll_run_lines_select_privileged"
ON payroll_run_lines FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_run_lines_insert_privileged"
ON payroll_run_lines FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_run_lines_update_privileged"
ON payroll_run_lines FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_run_lines_delete_owner"
ON payroll_run_lines FOR DELETE
USING (get_my_role() = 'owner');

-- ─── 7. Audit triggers ───────────────────────────────────────

CREATE TRIGGER trg_audit_employee_contracts
  AFTER INSERT OR UPDATE OR DELETE ON employee_contracts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_employee_compensation_components
  AFTER INSERT OR UPDATE OR DELETE ON employee_compensation_components
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_employee_project_assignments
  AFTER INSERT OR UPDATE OR DELETE ON employee_project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_payroll_runs
  AFTER INSERT OR UPDATE OR DELETE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_payroll_run_lines
  AFTER INSERT OR UPDATE OR DELETE ON payroll_run_lines
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
