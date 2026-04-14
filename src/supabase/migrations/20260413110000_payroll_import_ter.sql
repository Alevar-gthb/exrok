-- ============================================================
-- 20260413110000_payroll_import_ter.sql
-- Payroll import foundation: employee tax profile, TER master,
-- and hybrid tax snapshot on payroll lines.
-- ============================================================

-- 1) Employee tax profile
ALTER TABLE employees ADD COLUMN IF NOT EXISTS npwp text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_status text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ptkp_status text;

CREATE UNIQUE INDEX IF NOT EXISTS employees_npwp_unique
  ON employees (npwp) WHERE npwp IS NOT NULL AND btrim(npwp) <> '';

ALTER TABLE employees
  ADD CONSTRAINT employees_tax_status_check
  CHECK (tax_status IS NULL OR tax_status IN ('Gross', 'Net'));

-- 2) TER master data (JSON bracket cards by category)
CREATE TABLE IF NOT EXISTS payroll_ter_rate_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category text NOT NULL UNIQUE CHECK (category IN ('A', 'B', 'C')),
  brackets jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_payroll_ter_rate_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_payroll_ter_rate_cards_updated_at ON payroll_ter_rate_cards;
CREATE TRIGGER trg_touch_payroll_ter_rate_cards_updated_at
BEFORE UPDATE ON payroll_ter_rate_cards
FOR EACH ROW EXECUTE FUNCTION touch_payroll_ter_rate_cards_updated_at();

-- 3) Hybrid tax snapshot on payroll run line
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS gross_income numeric(15, 2);
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS ter_category text CHECK (ter_category IS NULL OR ter_category IN ('A', 'B', 'C'));
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS ter_rate numeric(8, 6);
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS pph21_excel numeric(15, 2);
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS pph21_system numeric(15, 2);
ALTER TABLE payroll_run_lines ADD COLUMN IF NOT EXISTS pph21_gap numeric(15, 2);

-- 4) Seed TER cards (monthly gross threshold, as used in workbook)
INSERT INTO payroll_ter_rate_cards (category, brackets)
VALUES
(
  'A',
  '[
    {"max":5400000,"rate":0.0025},{"max":5650000,"rate":0.005},{"max":5950000,"rate":0.0075},
    {"max":6300000,"rate":0.01},{"max":6750000,"rate":0.0125},{"max":7500000,"rate":0.015},
    {"max":8550000,"rate":0.0175},{"max":9650000,"rate":0.02},{"max":10050000,"rate":0.0225},
    {"max":10350000,"rate":0.025},{"max":10700000,"rate":0.03},{"max":11050000,"rate":0.035},
    {"max":11600000,"rate":0.04},{"max":12500000,"rate":0.05},{"max":13750000,"rate":0.06},
    {"max":15100000,"rate":0.07},{"max":16950000,"rate":0.08},{"max":19750000,"rate":0.09},
    {"max":24150000,"rate":0.10},{"max":26450000,"rate":0.11},{"max":28000000,"rate":0.12},
    {"max":30050000,"rate":0.13},{"max":32400000,"rate":0.14},{"max":35400000,"rate":0.15},
    {"max":39100000,"rate":0.16},{"max":43850000,"rate":0.17},{"max":47800000,"rate":0.18},
    {"max":51400000,"rate":0.19},{"max":56300000,"rate":0.20},{"max":62200000,"rate":0.21},
    {"max":68600000,"rate":0.22},{"max":77500000,"rate":0.23},{"max":89000000,"rate":0.24},
    {"max":103000000,"rate":0.25},{"max":125000000,"rate":0.26},{"max":157000000,"rate":0.27},
    {"max":206000000,"rate":0.28},{"max":337000000,"rate":0.29},{"max":454000000,"rate":0.30},
    {"max":550000000,"rate":0.31},{"max":695000000,"rate":0.32},{"max":910000000,"rate":0.33},
    {"max":11400000000,"rate":0.34}
  ]'::jsonb
),
(
  'B',
  '[
    {"max":6200000,"rate":0.0025},{"max":6500000,"rate":0.005},{"max":6850000,"rate":0.0075},
    {"max":7300000,"rate":0.01},{"max":9200000,"rate":0.015},{"max":10750000,"rate":0.02},
    {"max":11250000,"rate":0.025},{"max":11600000,"rate":0.03},{"max":12600000,"rate":0.04},
    {"max":13600000,"rate":0.05},{"max":14950000,"rate":0.06},{"max":16400000,"rate":0.07},
    {"max":18450000,"rate":0.08},{"max":21850000,"rate":0.09},{"max":26000000,"rate":0.10},
    {"max":27700000,"rate":0.11},{"max":29350000,"rate":0.12},{"max":31450000,"rate":0.13},
    {"max":33950000,"rate":0.14},{"max":37100000,"rate":0.15},{"max":41100000,"rate":0.16},
    {"max":45800000,"rate":0.17},{"max":49500000,"rate":0.18},{"max":53800000,"rate":0.19},
    {"max":58500000,"rate":0.20},{"max":64000000,"rate":0.21},{"max":71000000,"rate":0.22},
    {"max":80000000,"rate":0.23},{"max":93000000,"rate":0.24},{"max":109000000,"rate":0.25},
    {"max":129000000,"rate":0.26},{"max":163000000,"rate":0.27},{"max":211000000,"rate":0.28},
    {"max":374000000,"rate":0.29},{"max":459000000,"rate":0.30},{"max":555000000,"rate":0.31},
    {"max":704000000,"rate":0.32},{"max":957000000,"rate":0.33},{"max":1405000000,"rate":0.34}
  ]'::jsonb
),
(
  'C',
  '[
    {"max":6600000,"rate":0.0025},{"max":6950000,"rate":0.005},{"max":7350000,"rate":0.0075},
    {"max":7800000,"rate":0.01},{"max":8850000,"rate":0.0125},{"max":9800000,"rate":0.015},
    {"max":10950000,"rate":0.0175},{"max":11200000,"rate":0.02},{"max":12050000,"rate":0.03},
    {"max":12950000,"rate":0.04},{"max":14150000,"rate":0.05},{"max":15550000,"rate":0.06},
    {"max":17050000,"rate":0.07},{"max":19500000,"rate":0.08},{"max":22700000,"rate":0.09},
    {"max":26600000,"rate":0.10},{"max":28100000,"rate":0.11},{"max":30100000,"rate":0.12},
    {"max":32600000,"rate":0.13},{"max":35400000,"rate":0.14},{"max":38900000,"rate":0.15},
    {"max":43000000,"rate":0.16},{"max":47400000,"rate":0.17},{"max":51200000,"rate":0.18},
    {"max":55800000,"rate":0.19},{"max":60400000,"rate":0.20},{"max":66700000,"rate":0.21},
    {"max":74500000,"rate":0.22},{"max":83200000,"rate":0.23},{"max":95600000,"rate":0.24},
    {"max":110000000,"rate":0.25},{"max":134000000,"rate":0.26},{"max":169000000,"rate":0.27},
    {"max":221000000,"rate":0.28},{"max":390000000,"rate":0.29},{"max":463000000,"rate":0.30},
    {"max":561000000,"rate":0.31},{"max":709000000,"rate":0.32},{"max":965000000,"rate":0.33},
    {"max":1419000000,"rate":0.34}
  ]'::jsonb
)
ON CONFLICT (category) DO UPDATE
SET brackets = EXCLUDED.brackets,
    is_active = true;

-- 5) RLS + policy
ALTER TABLE payroll_ter_rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_ter_rate_cards_select_privileged"
  ON payroll_ter_rate_cards FOR SELECT
  USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "payroll_ter_rate_cards_insert_owner"
  ON payroll_ter_rate_cards FOR INSERT
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY "payroll_ter_rate_cards_update_owner"
  ON payroll_ter_rate_cards FOR UPDATE
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY "payroll_ter_rate_cards_delete_owner"
  ON payroll_ter_rate_cards FOR DELETE
  USING (get_my_role() = 'owner');

CREATE TRIGGER trg_audit_payroll_ter_rate_cards
  AFTER INSERT OR UPDATE OR DELETE ON payroll_ter_rate_cards
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
