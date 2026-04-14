-- ============================================================
-- Hapus status Submitted: tanpa rule → Pending Approval + baris approval
-- Migrasi data Submitted lama
-- ============================================================

-- Baris approval untuk expense Submitted yang belum punya riwayat approval
INSERT INTO expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes)
SELECT e.id, NULL, NULL, 'Pending', 'Migrasi: sebelumnya status Submitted tanpa rule'
FROM expenses e
WHERE e.status = 'Submitted'
  AND NOT EXISTS (SELECT 1 FROM expense_approvals ea WHERE ea.expense_id = e.id);

UPDATE expenses SET status = 'Pending Approval' WHERE status = 'Submitted';

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status = ANY (ARRAY[
    'Draft',
    'Pending Approval',
    'Approved',
    'Rejected',
    'Paid'
  ]));

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
    AND (
      payment_methods IS NULL
      OR COALESCE(cardinality(payment_methods), 0) = 0
      OR (
        v_expense.payment_method IS NOT NULL
        AND v_expense.payment_method = ANY (payment_methods)
      )
    )
    AND (
      excluded_payment_methods IS NULL
      OR COALESCE(cardinality(excluded_payment_methods), 0) = 0
      OR (
        v_expense.payment_method IS NULL
        OR NOT (v_expense.payment_method = ANY (excluded_payment_methods))
      )
    )
  ORDER BY priority ASC
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE expenses SET status = 'Pending Approval' WHERE id = p_expense_id;
    INSERT INTO expense_approvals (expense_id, approval_rule_id, approver_employee_id, status, notes)
    VALUES (p_expense_id, NULL, NULL, 'Pending', 'Tidak ada rule yang cocok — menunggu penanganan owner/finance');
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Expense menunggu persetujuan (tidak ada rule yang cocok)',
      'status', 'Pending Approval'
    );
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

-- Pembuat boleh hapus expense Draft sendiri (rollback jika submit_expense gagal setelah insert)
DROP POLICY IF EXISTS "expenses_delete_own_draft" ON expenses;
CREATE POLICY "expenses_delete_own_draft"
ON expenses FOR DELETE
USING (created_by = auth.uid() AND status = 'Draft');
