-- ============================================================
-- 20260415220000_rls_helpers_plpgsql_no_inline.sql
-- LANGUAGE sql STABLE helpers can be inlined into RLS policy
-- expressions; inlined scans may still see row_security=on and
-- re-enter employees policies (42P17). Use plpgsql so the body
-- runs as a real function boundary with SET row_security=off.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  rid uuid;
BEGIN
  SELECT e.id
  INTO rid
  FROM employees e
  WHERE lower(btrim(coalesce(e.email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  LIMIT 1;
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  r text;
BEGIN
  SELECT e.role
  INTO r
  FROM employees e
  WHERE e.id = get_my_employee_id()
  LIMIT 1;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_employee_record()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  j jsonb;
BEGIN
  SELECT to_jsonb(t)
  INTO j
  FROM (
    SELECT e.id, e.full_name, e.role
    FROM employees e
    WHERE lower(btrim(coalesce(e.email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    LIMIT 1
  ) t;
  RETURN j;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_employee_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_employee_record() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
