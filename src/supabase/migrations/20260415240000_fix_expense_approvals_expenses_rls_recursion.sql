-- ============================================================
-- 20260415240000_fix_expense_approvals_expenses_rls_recursion.sql
-- 42P17 on "expenses": expenses_select_pending_approver scans
-- expense_approvals; expense_approvals_select_own_expense used
--   expense_id IN (SELECT id FROM expenses WHERE created_by = auth.uid())
-- which re-evaluates expenses RLS → infinite recursion.
--
-- Replace the subquery with a SECURITY DEFINER helper that reads
-- expenses with row_security off (no RLS re-entry). Returns only
-- boolean — safe to GRANT EXECUTE (RPC cannot learn other users' uid).
-- ============================================================

CREATE OR REPLACE FUNCTION public.expense_created_by_matches_auth(p_expense_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  uid uuid;
BEGIN
  IF p_expense_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT e.created_by
  INTO uid
  FROM public.expenses e
  WHERE e.id = p_expense_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN uid IS NOT DISTINCT FROM auth.uid();
END;
$$;

ALTER FUNCTION public.expense_created_by_matches_auth(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.expense_created_by_matches_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_created_by_matches_auth(uuid) TO authenticated;

DROP POLICY IF EXISTS "expense_approvals_select_own_expense" ON public.expense_approvals;
CREATE POLICY "expense_approvals_select_own_expense" ON public.expense_approvals
  FOR SELECT
  USING (public.expense_created_by_matches_auth(expense_id));
