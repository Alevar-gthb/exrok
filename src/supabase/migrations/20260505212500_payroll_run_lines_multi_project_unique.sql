-- Support multi-project payroll import per employee in a run.
-- Keep only one fallback line with NULL project_id, while allowing many project-specific lines.

ALTER TABLE public.payroll_run_lines
  DROP CONSTRAINT IF EXISTS payroll_run_lines_run_id_employee_id_key;

DROP INDEX IF EXISTS public.payroll_run_lines_run_id_employee_id_project_id_key;
DROP INDEX IF EXISTS public.payroll_run_lines_unique_with_project;
DROP INDEX IF EXISTS public.payroll_run_lines_unique_without_project;

CREATE UNIQUE INDEX payroll_run_lines_unique_with_project
  ON public.payroll_run_lines (run_id, employee_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX payroll_run_lines_unique_without_project
  ON public.payroll_run_lines (run_id, employee_id)
  WHERE project_id IS NULL;
