-- ============================================================
-- 20260415203000_employee_rls_helper_row_security_off.sql
-- PostgREST returns 42P17 when policies on `employees` (or any
-- policy calling get_my_role) recurse into RLS on `employees`.
-- Re-assert row_security=off on helpers (safe if already set).
-- Also covers get_my_employee_record() which reads `employees`.
-- ============================================================

ALTER FUNCTION public.get_my_employee_id() SET row_security = off;
ALTER FUNCTION public.get_my_role() SET row_security = off;
ALTER FUNCTION public.get_my_employee_record() SET row_security = off;
