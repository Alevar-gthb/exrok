-- ============================================================
-- Payroll import progress tracking for Realtime subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_import_jobs (
  id uuid PRIMARY KEY,
  created_by uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry-run', 'commit')),
  year integer NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')) DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'queued',
  message text,
  sheets_processed integer NOT NULL DEFAULT 0,
  rows_processed integer NOT NULL DEFAULT 0,
  employees_upserted integer NOT NULL DEFAULT 0,
  components_upserted integer NOT NULL DEFAULT 0,
  payroll_lines_upserted integer NOT NULL DEFAULT 0,
  mismatch_count integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_payroll_import_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_payroll_import_jobs_updated_at ON public.payroll_import_jobs;
CREATE TRIGGER trg_touch_payroll_import_jobs_updated_at
BEFORE UPDATE ON public.payroll_import_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_payroll_import_jobs_updated_at();

ALTER TABLE public.payroll_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_import_jobs_select_owner_finance" ON public.payroll_import_jobs;
CREATE POLICY "payroll_import_jobs_select_owner_finance"
ON public.payroll_import_jobs FOR SELECT
USING (request_my_role() IN ('owner', 'finance'));

DROP POLICY IF EXISTS "payroll_import_jobs_insert_owner_finance" ON public.payroll_import_jobs;
CREATE POLICY "payroll_import_jobs_insert_owner_finance"
ON public.payroll_import_jobs FOR INSERT
WITH CHECK (
  request_my_role() IN ('owner', 'finance')
  AND created_by = request_my_employee_id()
);

DROP POLICY IF EXISTS "payroll_import_jobs_update_owner_finance" ON public.payroll_import_jobs;
CREATE POLICY "payroll_import_jobs_update_owner_finance"
ON public.payroll_import_jobs FOR UPDATE
USING (
  request_my_role() IN ('owner', 'finance')
  AND created_by = request_my_employee_id()
)
WITH CHECK (
  request_my_role() IN ('owner', 'finance')
  AND created_by = request_my_employee_id()
);
