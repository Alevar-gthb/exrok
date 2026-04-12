-- ============================================================
-- 20260412140000_salary_component_master.sql
-- Master komponen gaji + penugasan per karyawan (template + nominal)
-- Mengganti employee_compensation_components.
-- ============================================================

-- ─── 1. Master komponen ──────────────────────────────────────

CREATE TABLE salary_component_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('earning', 'deduction')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_component_templates_active ON salary_component_templates (is_active);

-- ─── 2. Nominal per karyawan (FK ke master) ───────────────────

CREATE TABLE employee_salary_component_amounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES salary_component_templates(id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, template_id)
);

CREATE INDEX idx_employee_salary_amounts_employee ON employee_salary_component_amounts(employee_id);
CREATE INDEX idx_employee_salary_amounts_template ON employee_salary_component_amounts(template_id);

-- ─── 3. Karyawan tetap (tanpa modul kontrak/perpanjangan) ─────

ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

-- ─── 4. Migrasi dari employee_compensation_components (jika ada) ─

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employee_compensation_components'
  ) THEN
    INSERT INTO salary_component_templates (code, label, kind)
    SELECT DISTINCT ON (lower(btrim(code)))
      btrim(code),
      label,
      kind
    FROM employee_compensation_components
    ORDER BY lower(btrim(code)), id
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO employee_salary_component_amounts (employee_id, template_id, amount)
    SELECT ecc.employee_id, t.id, ecc.amount
    FROM employee_compensation_components ecc
    JOIN salary_component_templates t ON lower(btrim(t.code)) = lower(btrim(ecc.code))
    ON CONFLICT (employee_id, template_id) DO UPDATE SET amount = EXCLUDED.amount;

    DROP TRIGGER IF EXISTS trg_audit_employee_compensation_components ON employee_compensation_components;
    DROP POLICY IF EXISTS "employee_compensation_select_privileged" ON employee_compensation_components;
    DROP POLICY IF EXISTS "employee_compensation_insert_privileged" ON employee_compensation_components;
    DROP POLICY IF EXISTS "employee_compensation_update_privileged" ON employee_compensation_components;
    DROP POLICY IF EXISTS "employee_compensation_delete_owner" ON employee_compensation_components;
    DROP TABLE employee_compensation_components;
  END IF;
END $$;

-- ─── 5. Seed minimal ───────────────────────────────────────────

INSERT INTO salary_component_templates (code, label, kind)
VALUES ('BASE', 'Gaji pokok', 'earning')
ON CONFLICT (code) DO NOTHING;

-- ─── 6. RLS ───────────────────────────────────────────────────

ALTER TABLE salary_component_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_component_amounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_templates_select_privileged"
  ON salary_component_templates FOR SELECT
  USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "salary_templates_insert_privileged"
  ON salary_component_templates FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "salary_templates_update_privileged"
  ON salary_component_templates FOR UPDATE
  USING (get_my_role() IN ('owner', 'finance'))
  WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "salary_templates_delete_owner"
  ON salary_component_templates FOR DELETE
  USING (get_my_role() = 'owner');

CREATE POLICY "employee_salary_amounts_select_privileged"
  ON employee_salary_component_amounts FOR SELECT
  USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_salary_amounts_insert_privileged"
  ON employee_salary_component_amounts FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_salary_amounts_update_privileged"
  ON employee_salary_component_amounts FOR UPDATE
  USING (get_my_role() IN ('owner', 'finance'))
  WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "employee_salary_amounts_delete_privileged"
  ON employee_salary_component_amounts FOR DELETE
  USING (get_my_role() IN ('owner', 'finance'));

-- ─── 7. Audit triggers ─────────────────────────────────────────

CREATE TRIGGER trg_audit_salary_component_templates
  AFTER INSERT OR UPDATE OR DELETE ON salary_component_templates
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_employee_salary_component_amounts
  AFTER INSERT OR UPDATE OR DELETE ON employee_salary_component_amounts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
