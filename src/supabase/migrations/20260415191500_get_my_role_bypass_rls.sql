-- ============================================================
-- 20260415191500_get_my_role_bypass_rls.sql
-- Policies on `employees` call get_my_role() / get_my_employee_id().
-- Those functions SELECT `employees` again; with RLS on for the
-- invoker, Postgres detects infinite recursion (SQLSTATE 42P17).
-- Disable row security for the SECURITY DEFINER body only.
-- ============================================================

ALTER FUNCTION public.get_my_employee_id() SET row_security = off;
ALTER FUNCTION public.get_my_role() SET row_security = off;
