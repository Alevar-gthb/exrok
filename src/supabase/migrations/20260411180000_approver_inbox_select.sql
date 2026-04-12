-- ============================================================
-- Approver dapat SELECT expense & employee terkait untuk inbox
-- (nested query dari expense_approvals memakai RLS per tabel)
-- ============================================================

CREATE POLICY "expenses_select_pending_approver"
ON expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM expense_approvals ea
    WHERE ea.expense_id = expenses.id
      AND ea.status = 'Pending'
      AND ea.approver_employee_id = (
        SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
      )
  )
);

CREATE POLICY "employees_select_pending_approval_party"
ON employees FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM expense_approvals ea
    INNER JOIN expenses ex ON ex.id = ea.expense_id
    WHERE ea.status = 'Pending'
      AND ea.approver_employee_id = (
        SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1
      )
      AND ex.employee_id = employees.id
  )
);
