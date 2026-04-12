-- ============================================================
-- 20260406140000_approval_system.sql — Approval rules & workflow
-- ============================================================

-- ─── 1a. Status expenses ─────────────────────────────────────
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;

UPDATE expenses SET status = 'Draft'
WHERE status IS NOT NULL AND status NOT IN (
  'Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected', 'Paid'
);

ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status = ANY (ARRAY[
    'Draft',
    'Submitted',
    'Pending Approval',
    'Approved',
    'Rejected',
    'Paid'
  ]));

-- Staff/GA: boleh update expense sendiri saat Draft atau Rejected (resubmit)
DROP POLICY IF EXISTS "expenses_update_own_draft" ON expenses;
CREATE POLICY "expenses_update_own_draft"
ON expenses FOR UPDATE
USING (
  created_by = auth.uid()
  AND status IN ('Draft', 'Rejected')
);

-- ─── 1b. approval_rules ──────────────────────────────────────
CREATE TABLE approval_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  business_unit text CHECK (business_unit = ANY (ARRAY['RKT', 'SPH']) OR business_unit IS NULL),
  expense_type text CHECK (expense_type = ANY (ARRAY['PO', 'Reimburse', 'Salary']) OR expense_type IS NULL),
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  require_approval boolean NOT NULL DEFAULT true,
  approver_employee_id uuid REFERENCES employees(id),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN approval_rules.min_amount IS 'Batas bawah amount (inclusive)';
COMMENT ON COLUMN approval_rules.max_amount IS 'Batas atas amount (inclusive), NULL = tidak terbatas';
COMMENT ON COLUMN approval_rules.require_approval IS 'false = auto-approve tanpa perlu approval manual';
COMMENT ON COLUMN approval_rules.priority IS 'Urutan pencocokan rule, angka kecil = prioritas lebih tinggi';

-- ─── 1c. expense_approvals ───────────────────────────────────
CREATE TABLE expense_approvals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  approval_rule_id uuid REFERENCES approval_rules(id) ON DELETE SET NULL,
  approver_employee_id uuid REFERENCES employees(id),
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status = ANY (ARRAY['Pending', 'Approved', 'Rejected'])),
  notes text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_rules_select_all" ON approval_rules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "approval_rules_write_owner" ON approval_rules
  FOR ALL
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY "expense_approvals_select_approver" ON expense_approvals
  FOR SELECT USING (
    approver_employee_id = (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
    )
  );

CREATE POLICY "expense_approvals_select_privileged" ON expense_approvals
  FOR SELECT USING (get_my_role() = ANY (ARRAY['owner', 'finance']));

CREATE POLICY "expense_approvals_select_own_expense" ON expense_approvals
  FOR SELECT USING (
    expense_id IN (
      SELECT id FROM expenses WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "expense_approvals_insert_privileged" ON expense_approvals
  FOR INSERT WITH CHECK (get_my_role() = ANY (ARRAY['owner', 'finance']));

CREATE POLICY "expense_approvals_update_approver" ON expense_approvals
  FOR UPDATE USING (
    approver_employee_id = (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
    )
    OR get_my_role() = 'owner'
  )
  WITH CHECK (
    approver_employee_id = (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
    )
    OR get_my_role() = 'owner'
  );

-- ─── 1e. submit_expense ──────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_expense(p_expense_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense expenses%ROWTYPE;
  v_rule approval_rules%ROWTYPE;
BEGIN
  SELECT * INTO v_expense FROM expenses
  WHERE id = p_expense_id AND (created_by = auth.uid() OR get_my_role() = ANY (ARRAY['owner','finance']));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Expense tidak ditemukan atau tidak punya akses');
  END IF;

  IF v_expense.status != 'Draft' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya expense berstatus Draft yang bisa disubmit');
  END IF;

  SELECT * INTO v_rule FROM approval_rules
  WHERE is_active = true
    AND v_expense.amount >= min_amount
    AND (max_amount IS NULL OR v_expense.amount <= max_amount)
    AND (business_unit IS NULL OR business_unit = v_expense.business_unit)
    AND (expense_type IS NULL OR expense_type = v_expense.type)
  ORDER BY priority ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE expenses SET status = 'Submitted' WHERE id = p_expense_id;
    RETURN jsonb_build_object('success', true, 'message', 'Expense disubmit, menunggu konfigurasi approval', 'status', 'Submitted');
  END IF;

  IF v_rule.require_approval = false THEN
    UPDATE expenses SET status = 'Approved' WHERE id = p_expense_id;
    INSERT INTO expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes, approved_at)
    VALUES (p_expense_id, v_rule.id, NULL, 'Approved', 'Auto-approved berdasarkan rule: ' || v_rule.name, NOW());
    RETURN jsonb_build_object('success', true, 'message', 'Expense auto-approved', 'status', 'Approved');
  ELSE
    UPDATE expenses SET status = 'Pending Approval' WHERE id = p_expense_id;
    INSERT INTO expense_approvals (expense_id, approval_rule_id, approver_employee_id, status)
    VALUES (p_expense_id, v_rule.id, v_rule.approver_employee_id, 'Pending');
    RETURN jsonb_build_object('success', true, 'message', 'Expense dikirim ke approver', 'status', 'Pending Approval');
  END IF;
END;
$$;

-- ─── 1f. process_approval ──────────────────────────────────────
CREATE OR REPLACE FUNCTION process_approval(
  p_expense_approval_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval expense_approvals%ROWTYPE;
  v_my_employee_id uuid;
BEGIN
  SELECT id INTO v_my_employee_id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1;

  SELECT * INTO v_approval FROM expense_approvals WHERE id = p_expense_approval_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Data approval tidak ditemukan');
  END IF;

  IF (v_my_employee_id IS DISTINCT FROM v_approval.approver_employee_id) AND get_my_role() != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tidak punya akses untuk approve ini');
  END IF;

  IF v_approval.status != 'Pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Approval sudah diproses sebelumnya');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE expense_approvals
    SET status = 'Approved', notes = p_notes, approved_at = NOW()
    WHERE id = p_expense_approval_id;

    UPDATE expenses SET status = 'Approved' WHERE id = v_approval.expense_id;

    RETURN jsonb_build_object('success', true, 'message', 'Expense berhasil diapprove', 'status', 'Approved');
  ELSIF p_action = 'reject' THEN
    UPDATE expense_approvals
    SET status = 'Rejected', notes = p_notes, approved_at = NOW()
    WHERE id = p_expense_approval_id;

    UPDATE expenses SET status = 'Rejected' WHERE id = v_approval.expense_id;

    RETURN jsonb_build_object('success', true, 'message', 'Expense ditolak', 'status', 'Rejected');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid, gunakan approve atau reject');
  END IF;
END;
$$;

-- ─── 1g. bulk_process_approval ─────────────────────────────────
CREATE OR REPLACE FUNCTION bulk_process_approval(
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
  v_result jsonb;
  v_success_count int := 0;
  v_failed_count int := 0;
BEGIN
  FOREACH v_id IN ARRAY p_expense_approval_ids LOOP
    v_result := process_approval(v_id, p_action, p_notes);
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

GRANT EXECUTE ON FUNCTION submit_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_process_approval(uuid[], text, text) TO authenticated;

-- ─── 1h. Audit triggers ───────────────────────────────────────
CREATE TRIGGER trg_audit_approval_rules
  AFTER INSERT OR UPDATE OR DELETE ON approval_rules
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_expense_approvals
  AFTER INSERT OR UPDATE OR DELETE ON expense_approvals
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
