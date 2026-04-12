-- ============================================================
-- 20260412120000_employee_nip_job_finance.sql
-- NIP & jabatan; finance boleh kelola data karyawan (tanpa ubah role/email/gaji legacy/nip)
-- Jalankan SETELAH 20260411190000_hr_payroll.sql (tabel HR harus sudah ada).
-- ============================================================

-- ─── 1. Kolom karyawan ───────────────────────────────────────

ALTER TABLE employees ADD COLUMN IF NOT EXISTS nip text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title text;

CREATE UNIQUE INDEX IF NOT EXISTS employees_nip_unique ON employees (nip) WHERE nip IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS employee_internal_nip_seq START WITH 1;

CREATE OR REPLACE FUNCTION assign_employee_nip()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nip IS NULL OR btrim(NEW.nip) = '' THEN
    NEW.nip := 'NIP-' || lpad(nextval('employee_internal_nip_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_employee_nip ON employees;
CREATE TRIGGER trg_assign_employee_nip
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION assign_employee_nip();

-- Backfill NIP untuk baris lama
DO $$
DECLARE
  r record;
  i integer := 1;
BEGIN
  FOR r IN SELECT id FROM employees WHERE nip IS NULL OR btrim(nip) = '' ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE employees SET nip = 'NIP-' || lpad(i::text, 6, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

SELECT setval(
  'employee_internal_nip_seq',
  greatest(
    0::bigint,
    coalesce(
      (SELECT max(
        CASE
          WHEN nip ~ '^NIP-[0-9]+$' THEN substring(nip from 5)::bigint
          ELSE 0::bigint
        END
      ) FROM employees),
      0::bigint
    )
  ) + 1,
  false
);

-- ─── 2. Guard: finance tidak ubah role/email/salary_amount/nip ─

CREATE OR REPLACE FUNCTION fn_employees_finance_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1;

  IF v_role = 'finance' THEN
    IF tg_op = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.salary_amount IS DISTINCT FROM OLD.salary_amount
        OR NEW.nip IS DISTINCT FROM OLD.nip
      THEN
        RAISE EXCEPTION 'Finance tidak dapat mengubah email, role, NIP, atau kolom gaji legacy';
      END IF;
    ELSIF tg_op = 'INSERT' THEN
      NEW.role := 'staff';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_finance_guard ON employees;
CREATE TRIGGER trg_employees_finance_guard
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION fn_employees_finance_guard();

-- ─── 3. RLS: finance insert & update employees ─────────────────

CREATE POLICY "employees_insert_finance"
  ON employees FOR INSERT
  WITH CHECK (get_my_role() = 'finance');

CREATE POLICY "employees_update_finance"
  ON employees FOR UPDATE
  USING (get_my_role() = 'finance')
  WITH CHECK (get_my_role() = 'finance');
