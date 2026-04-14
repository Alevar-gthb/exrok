-- Komponen seperti THR tidak ikut ke dasar gaji bulanan (hanya periode tertentu).
ALTER TABLE salary_component_templates
  ADD COLUMN IF NOT EXISTS include_in_monthly_payroll boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN salary_component_templates.include_in_monthly_payroll IS
  'Jika false, nominal tidak dijumlahkan ke bruto/net gaji bulanan reguler (mis. THR).';

UPDATE salary_component_templates
SET include_in_monthly_payroll = false
WHERE lower(btrim(code)) = 'thr';
