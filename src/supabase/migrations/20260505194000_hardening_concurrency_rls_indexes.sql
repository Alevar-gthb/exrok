-- ============================================================
-- Hardening: optimistic locking, RLS helper cache, FK indexes
-- ============================================================

-- 1) updated_at columns + touch triggers
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.expense_approvals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_touch_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_expense_approvals_updated_at ON public.expense_approvals;
CREATE TRIGGER trg_touch_expense_approvals_updated_at
BEFORE UPDATE ON public.expense_approvals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Session-scoped auth context cache for RLS helper calls.
--    This avoids repeating employees lookup on each policy row evaluation.
CREATE OR REPLACE FUNCTION public.request_my_employee_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  cached text;
  rid uuid;
BEGIN
  cached := current_setting('request.my_employee_id', true);
  IF cached IS NOT NULL AND cached <> '' THEN
    RETURN cached::uuid;
  END IF;

  rid := get_my_employee_id();
  PERFORM set_config('request.my_employee_id', coalesce(rid::text, ''), true);
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  cached text;
  r text;
BEGIN
  cached := current_setting('request.my_role', true);
  IF cached IS NOT NULL AND cached <> '' THEN
    RETURN cached;
  END IF;

  SELECT e.role
  INTO r
  FROM public.employees e
  WHERE e.id = request_my_employee_id()
  LIMIT 1;

  PERFORM set_config('request.my_role', coalesce(r, ''), true);
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.request_my_employee_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_my_role() TO authenticated;

-- Rebuild hotspot policies to use cached helpers.
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own"
ON public.employees FOR SELECT
USING (
  request_my_role() IN ('staff', 'ga')
  AND id = request_my_employee_id()
);

DROP POLICY IF EXISTS "expense_approvals_select_approver" ON public.expense_approvals;
CREATE POLICY "expense_approvals_select_approver" ON public.expense_approvals
  FOR SELECT USING (approver_employee_id = request_my_employee_id());

DROP POLICY IF EXISTS "expense_approvals_update_approver" ON public.expense_approvals;
CREATE POLICY "expense_approvals_update_approver" ON public.expense_approvals
  FOR UPDATE USING (
    approver_employee_id = request_my_employee_id()
    OR request_my_role() = 'owner'
  )
  WITH CHECK (
    approver_employee_id = request_my_employee_id()
    OR request_my_role() = 'owner'
  );

DROP POLICY IF EXISTS "expenses_select_pending_approver" ON public.expenses;
CREATE POLICY "expenses_select_pending_approver"
ON public.expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.expense_approvals ea
    WHERE ea.expense_id = expenses.id
      AND ea.status = 'Pending'
      AND ea.approver_employee_id = request_my_employee_id()
  )
);

DROP POLICY IF EXISTS "employees_select_pending_approval_party" ON public.employees;
CREATE POLICY "employees_select_pending_approval_party"
ON public.employees FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.expense_approvals ea
    INNER JOIN public.expenses ex ON ex.id = ea.expense_id
    WHERE ea.status = 'Pending'
      AND ea.approver_employee_id = request_my_employee_id()
      AND ex.employee_id = employees.id
  )
);

-- 3) CAS-aware submit_expense
CREATE OR REPLACE FUNCTION public.submit_expense(
  p_expense_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
  v_rule public.approval_rules%ROWTYPE;
  v_actor_role text;
BEGIN
  PERFORM set_config('request.my_employee_id', coalesce(request_my_employee_id()::text, ''), true);
  PERFORM set_config('request.my_role', coalesce(request_my_role(), ''), true);

  v_actor_role := request_my_role();

  SELECT *
  INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id
    AND (created_by = auth.uid() OR v_actor_role = ANY (ARRAY['owner', 'finance']));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expense tidak ditemukan atau tidak punya akses');
  END IF;

  IF v_expense.status <> 'Draft' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya expense berstatus Draft yang bisa disubmit');
  END IF;

  IF v_expense.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONCURRENT_MODIFICATION',
      'message', 'Data expense sudah berubah. Muat ulang lalu coba lagi.'
    );
  END IF;

  IF v_expense.payment_method = 'Petty Cash' THEN
    UPDATE public.expenses
    SET
      status = 'Paid',
      payment_date = coalesce(v_expense.transaction_date, CURRENT_DATE),
      payment_proof_url = coalesce(nullif(v_expense.document_url, ''), payment_proof_url)
    WHERE id = p_expense_id
      AND updated_at = p_expected_updated_at;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_MODIFICATION',
        'message', 'Data expense sudah berubah. Muat ulang lalu coba lagi.'
      );
    END IF;

    INSERT INTO public.expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes, approved_at)
    VALUES (
      p_expense_id,
      NULL,
      NULL,
      'Approved',
      'Auto-paid: metode pembayaran Petty Cash (receipt awal dijadikan bukti bayar)',
      now()
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Expense Petty Cash otomatis ditandai dibayar',
      'status', 'Paid'
    );
  END IF;

  SELECT *
  INTO v_rule
  FROM public.approval_rules
  WHERE is_active = true
    AND v_expense.amount >= min_amount
    AND (max_amount IS NULL OR v_expense.amount <= max_amount)
    AND (business_unit IS NULL OR business_unit = v_expense.business_unit)
    AND (expense_type IS NULL OR expense_type = v_expense.type)
    AND (
      payment_methods IS NULL
      OR coalesce(cardinality(payment_methods), 0) = 0
      OR (v_expense.payment_method IS NOT NULL AND v_expense.payment_method = ANY (payment_methods))
    )
    AND (
      excluded_payment_methods IS NULL
      OR coalesce(cardinality(excluded_payment_methods), 0) = 0
      OR (v_expense.payment_method IS NULL OR NOT (v_expense.payment_method = ANY (excluded_payment_methods)))
    )
  ORDER BY priority ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.expenses
    SET status = 'Pending Approval'
    WHERE id = p_expense_id
      AND updated_at = p_expected_updated_at;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_MODIFICATION',
        'message', 'Data expense sudah berubah. Muat ulang lalu coba lagi.'
      );
    END IF;

    INSERT INTO public.expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes)
    VALUES (p_expense_id, NULL, NULL, 'Pending', 'Tidak ada rule yang cocok — menunggu penanganan owner/finance');

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Expense menunggu persetujuan (tidak ada rule yang cocok)',
      'status', 'Pending Approval'
    );
  END IF;

  IF v_rule.require_approval = false THEN
    UPDATE public.expenses
    SET status = 'Approved'
    WHERE id = p_expense_id
      AND updated_at = p_expected_updated_at;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_MODIFICATION',
        'message', 'Data expense sudah berubah. Muat ulang lalu coba lagi.'
      );
    END IF;

    INSERT INTO public.expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes, approved_at)
    VALUES (p_expense_id, v_rule.id, NULL, 'Approved', 'Auto-approved berdasarkan rule: ' || v_rule.name, now());

    RETURN jsonb_build_object('success', true, 'message', 'Expense auto-approved', 'status', 'Approved');
  END IF;

  UPDATE public.expenses
  SET status = 'Pending Approval'
  WHERE id = p_expense_id
    AND updated_at = p_expected_updated_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONCURRENT_MODIFICATION',
      'message', 'Data expense sudah berubah. Muat ulang lalu coba lagi.'
    );
  END IF;

  INSERT INTO public.expense_approvals (expense_id, approval_rule_id, approver_employee_id, status)
  VALUES (p_expense_id, v_rule.id, v_rule.approver_employee_id, 'Pending');

  RETURN jsonb_build_object('success', true, 'message', 'Expense dikirim ke approver', 'status', 'Pending Approval');
END;
$$;

-- 4) CAS-aware process_approval
CREATE OR REPLACE FUNCTION public.process_approval(
  p_expense_approval_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval public.expense_approvals%ROWTYPE;
  v_my_employee_id uuid;
BEGIN
  v_my_employee_id := request_my_employee_id();
  PERFORM set_config('request.my_employee_id', coalesce(v_my_employee_id::text, ''), true);
  PERFORM set_config('request.my_role', coalesce(request_my_role(), ''), true);

  SELECT *
  INTO v_approval
  FROM public.expense_approvals
  WHERE id = p_expense_approval_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Data approval tidak ditemukan');
  END IF;

  IF (v_my_employee_id IS DISTINCT FROM v_approval.approver_employee_id) AND request_my_role() <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tidak punya akses untuk approve ini');
  END IF;

  IF v_approval.status <> 'Pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Approval sudah diproses sebelumnya');
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_approval.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONCURRENT_MODIFICATION',
      'message', 'Data approval sudah berubah. Muat ulang lalu coba lagi.'
    );
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.expense_approvals
    SET status = 'Approved', notes = p_notes, approved_at = now()
    WHERE id = p_expense_approval_id
      AND status = 'Pending'
      AND (
        p_expected_updated_at IS NULL
        OR updated_at = p_expected_updated_at
      );

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_MODIFICATION',
        'message', 'Approval sudah berubah. Muat ulang lalu coba lagi.'
      );
    END IF;

    UPDATE public.expenses
    SET status = 'Approved'
    WHERE id = v_approval.expense_id
      AND status = 'Pending Approval';

    RETURN jsonb_build_object('success', true, 'message', 'Expense berhasil diapprove', 'status', 'Approved');
  ELSIF p_action = 'reject' THEN
    UPDATE public.expense_approvals
    SET status = 'Rejected', notes = p_notes, approved_at = now()
    WHERE id = p_expense_approval_id
      AND status = 'Pending'
      AND (
        p_expected_updated_at IS NULL
        OR updated_at = p_expected_updated_at
      );

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CONCURRENT_MODIFICATION',
        'message', 'Approval sudah berubah. Muat ulang lalu coba lagi.'
      );
    END IF;

    UPDATE public.expenses
    SET status = 'Rejected'
    WHERE id = v_approval.expense_id
      AND status = 'Pending Approval';

    RETURN jsonb_build_object('success', true, 'message', 'Expense ditolak', 'status', 'Rejected');
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid, gunakan approve atau reject');
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_process_approval(
  p_expense_approval_ids uuid[],
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_updated_at timestamptz;
  v_result jsonb;
  v_success_count int := 0;
  v_failed_count int := 0;
BEGIN
  FOREACH v_id IN ARRAY p_expense_approval_ids LOOP
    SELECT updated_at INTO v_updated_at
    FROM public.expense_approvals
    WHERE id = v_id;

    v_result := public.process_approval(v_id, p_action, p_notes, v_updated_at);
    IF (v_result->>'success')::boolean THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failed_count := v_failed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_success_count,
    'failed', v_failed_count,
    'message', v_success_count || ' expense berhasil diproses, ' || v_failed_count || ' gagal'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_expense(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_expense(uuid, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.process_approval(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_approval(uuid, text, text, timestamptz) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bulk_process_approval(uuid[], text, text) TO authenticated;

-- 5) Composite indexes for high-traffic FK lookups
CREATE INDEX IF NOT EXISTS idx_expenses_employee_status
  ON public.expenses (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_expense_approvals_expense_status
  ON public.expense_approvals (expense_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_run_employee
  ON public.payroll_run_lines (run_id, employee_id);
