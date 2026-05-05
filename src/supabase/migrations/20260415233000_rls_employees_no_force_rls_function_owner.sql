-- ============================================================
-- 20260415233000_rls_employees_no_force_rls_function_owner.sql
-- Jika FORCE ROW LEVEL SECURITY pernah di-set pada `employees`,
-- pemilik tabel pun ikut RLS dan helper SECURITY DEFINER tetap
-- bisa memicu 42P17 saat policy memanggil helper yang baca
-- `employees`. Matikan FORCE untuk tabel inti ini.
--
-- Pastikan fungsi helper dimiliki role yang mem-bypass RLS
-- (biasanya postgres di Supabase).
-- ============================================================

ALTER TABLE IF EXISTS public.employees NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses NO FORCE ROW LEVEL SECURITY;

ALTER FUNCTION public.get_my_employee_id() OWNER TO postgres;
ALTER FUNCTION public.get_my_role() OWNER TO postgres;
ALTER FUNCTION public.get_my_employee_record() OWNER TO postgres;
