-- ============================================================
-- 20260415131500_auth_email_case_insensitive.sql
-- Normalisasi lookup auth.jwt()->>'email' agar case-insensitive
-- ============================================================

-- Helper: employee id user login saat ini (case-insensitive)
CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM employees
  WHERE lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  LIMIT 1;
$$;

-- Helper role lama diupgrade agar ikut case-insensitive
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM employees
  WHERE id = get_my_employee_id()
  LIMIT 1;
$$;

-- employees: akses data sendiri
DROP POLICY IF EXISTS "employees_select_own" ON employees;
CREATE POLICY "employees_select_own"
ON employees FOR SELECT
USING (
  get_my_role() IN ('staff', 'ga')
  AND id = get_my_employee_id()
);

-- expense approvals: approver select/update
DROP POLICY IF EXISTS "expense_approvals_select_approver" ON expense_approvals;
CREATE POLICY "expense_approvals_select_approver" ON expense_approvals
  FOR SELECT USING (approver_employee_id = get_my_employee_id());

DROP POLICY IF EXISTS "expense_approvals_update_approver" ON expense_approvals;
CREATE POLICY "expense_approvals_update_approver" ON expense_approvals
  FOR UPDATE USING (
    approver_employee_id = get_my_employee_id()
    OR get_my_role() = 'owner'
  )
  WITH CHECK (
    approver_employee_id = get_my_employee_id()
    OR get_my_role() = 'owner'
  );

-- Inbox approver: bisa baca expense & employee terkait approval pending
DROP POLICY IF EXISTS "expenses_select_pending_approver" ON expenses;
CREATE POLICY "expenses_select_pending_approver"
ON expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM expense_approvals ea
    WHERE ea.expense_id = expenses.id
      AND ea.status = 'Pending'
      AND ea.approver_employee_id = get_my_employee_id()
  )
);

DROP POLICY IF EXISTS "employees_select_pending_approval_party" ON employees;
CREATE POLICY "employees_select_pending_approval_party"
ON employees FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM expense_approvals ea
    INNER JOIN expenses ex ON ex.id = ea.expense_id
    WHERE ea.status = 'Pending'
      AND ea.approver_employee_id = get_my_employee_id()
      AND ex.employee_id = employees.id
  )
);

-- Lending: staff hanya boleh lihat pinjaman miliknya
DO $$
BEGIN
  IF to_regclass('public.item_loans') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "loans_select_own" ON item_loans';
    EXECUTE '
      CREATE POLICY "loans_select_own"
      ON item_loans FOR SELECT
      USING (get_my_role() = ''staff'' AND employee_id = get_my_employee_id())
    ';
  END IF;
END $$;

-- Finance guard: role actor dibaca case-insensitive via helper
CREATE OR REPLACE FUNCTION fn_employees_finance_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM employees WHERE id = get_my_employee_id() LIMIT 1;

  IF v_role = 'finance' THEN
    IF tg_op = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.salary_amount IS DISTINCT FROM OLD.salary_amount
        OR NEW.nip IS DISTINCT FROM OLD.nip
      THEN
        RAISE EXCEPTION 'Finance tidak dapat mengubah email, role, NIP, atau kolom gaji legacy';
      END IF;
    ELSIF tg_op = 'INSERT' THEN
      NEW.role := 'staff';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- process_approval: actor employee id via helper baru
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
  v_my_employee_id := get_my_employee_id();

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
