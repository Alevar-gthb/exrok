-- ============================================================
-- 20260415180000_get_my_employee_record.sql
-- Profil karyawan untuk session login: baca via SECURITY DEFINER
-- agar tidak terjebak RLS (mis. role NULL / policy tidak match).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_employee_record()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
