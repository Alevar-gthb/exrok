-- ============================================================
-- 20260415210000_recreate_rls_helpers_row_security_off.sql
-- If ALTER FUNCTION ... SET row_security was never applied, RLS
-- policies still recurse (42P17). Recreate helpers with
-- row_security OFF embedded in the function definition.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
  SELECT id
  FROM employees
  WHERE lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
  SELECT role
  FROM employees
  WHERE id = get_my_employee_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_employee_record()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT id, full_name, role
    FROM employees
    WHERE lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    LIMIT 1
  ) t;
$$;

REVOKE ALL ON FUNCTION public.get_my_employee_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_employee_record() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
