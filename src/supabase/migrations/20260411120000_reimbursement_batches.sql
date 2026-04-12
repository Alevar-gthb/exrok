-- ============================================================
-- 20260411120000_reimbursement_batches.sql — Batch reimbursement
-- ============================================================

-- ─── 1. Tables ───────────────────────────────────────────────

CREATE TABLE reimbursement_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_no text NOT NULL UNIQUE,
  batch_date date NOT NULL,
  payment_method text,
  reference_no text,
  notes text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reimbursement_batch_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid NOT NULL REFERENCES reimbursement_batches(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES expenses(id),
  amount_paid numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, expense_id)
);

CREATE INDEX idx_reimbursement_batch_items_batch_id ON reimbursement_batch_items(batch_id);
CREATE INDEX idx_reimbursement_batch_items_expense_id ON reimbursement_batch_items(expense_id);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS reimbursement_batch_id uuid REFERENCES reimbursement_batches(id);

CREATE INDEX IF NOT EXISTS idx_expenses_reimbursement_batch_id ON expenses(reimbursement_batch_id);

-- ─── 2. RPC: create_reimbursement_batch ─────────────────────

CREATE OR REPLACE FUNCTION create_reimbursement_batch(
  p_expense_ids uuid[],
  p_batch_date date,
  p_payment_method text,
  p_reference_no text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_batch_id uuid;
  v_batch_no text;
  v_total numeric(15,2);
  v_count int;
  v_input_count int;
BEGIN
  IF get_my_role() IS NULL OR get_my_role() NOT IN ('owner', 'finance') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Hanya owner atau finance yang dapat membuat batch reimburse'
    );
  END IF;

  IF p_expense_ids IS NULL OR cardinality(p_expense_ids) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pilih minimal satu expense');
  END IF;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_ids
  FROM (SELECT DISTINCT unnest(p_expense_ids) AS id) u;

  v_input_count := cardinality(v_ids);

  PERFORM 1
  FROM expenses e
  WHERE e.id = ANY (v_ids)
    AND e.status = 'Approved'
    AND e.reimbursement_batch_id IS NULL
  FOR UPDATE;

  SELECT coalesce(sum(e.total_payment::numeric), 0), count(*)::int
  INTO v_total, v_count
  FROM expenses e
  WHERE e.id = ANY (v_ids)
    AND e.status = 'Approved'
    AND e.reimbursement_batch_id IS NULL;

  IF v_count <> v_input_count OR v_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Beberapa expense tidak eligible (harus Approved, belum masuk batch)'
    );
  END IF;

  v_batch_no := 'RB-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO reimbursement_batches (
    batch_no,
    batch_date,
    payment_method,
    reference_no,
    notes,
    total_amount,
    created_by
  )
  VALUES (
    v_batch_no,
    p_batch_date,
    nullif(trim(p_payment_method), ''),
    nullif(trim(p_reference_no), ''),
    nullif(trim(p_notes), ''),
    v_total,
    auth.uid()
  )
  RETURNING id INTO v_batch_id;

  INSERT INTO reimbursement_batch_items (batch_id, expense_id, amount_paid)
  SELECT v_batch_id, e.id, e.total_payment::numeric
  FROM expenses e
  WHERE e.id = ANY (v_ids)
    AND e.status = 'Approved'
    AND e.reimbursement_batch_id IS NULL;

  UPDATE expenses e
  SET
    status = 'Paid',
    payment_date = p_batch_date,
    reimbursement_batch_id = v_batch_id
  WHERE e.id = ANY (v_ids);

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch_no', v_batch_no,
    'processed_count', v_count,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_reimbursement_batch(uuid[], date, text, text, text) TO authenticated;

-- ─── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE reimbursement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursement_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reimbursement_batches_select_privileged"
ON reimbursement_batches FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batches_select_own_items"
ON reimbursement_batches FOR SELECT
USING (
  get_my_role() IN ('staff', 'ga')
  AND EXISTS (
    SELECT 1
    FROM reimbursement_batch_items rbi
    JOIN expenses ex ON ex.id = rbi.expense_id
    WHERE rbi.batch_id = reimbursement_batches.id
      AND ex.created_by = auth.uid()
  )
);

CREATE POLICY "reimbursement_batches_insert_privileged"
ON reimbursement_batches FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batches_update_privileged"
ON reimbursement_batches FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batches_delete_owner"
ON reimbursement_batches FOR DELETE
USING (get_my_role() = 'owner');

CREATE POLICY "reimbursement_batch_items_select_privileged"
ON reimbursement_batch_items FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batch_items_select_own_expense"
ON reimbursement_batch_items FOR SELECT
USING (
  get_my_role() IN ('staff', 'ga')
  AND EXISTS (
    SELECT 1 FROM expenses ex
    WHERE ex.id = reimbursement_batch_items.expense_id
      AND ex.created_by = auth.uid()
  )
);

CREATE POLICY "reimbursement_batch_items_insert_privileged"
ON reimbursement_batch_items FOR INSERT
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batch_items_update_privileged"
ON reimbursement_batch_items FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

CREATE POLICY "reimbursement_batch_items_delete_owner"
ON reimbursement_batch_items FOR DELETE
USING (get_my_role() = 'owner');

-- ─── 4. Audit triggers ───────────────────────────────────────

CREATE TRIGGER trg_audit_reimbursement_batches
  AFTER INSERT OR UPDATE OR DELETE ON reimbursement_batches
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_reimbursement_batch_items
  AFTER INSERT OR UPDATE OR DELETE ON reimbursement_batch_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
