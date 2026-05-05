-- ============================================================
-- Atomic expense creation + submit RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_and_submit_expense(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_expense_id uuid;
  v_ref_no text;
  v_updated_at timestamptz;
  v_submit jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  INSERT INTO public.expenses (
    submission_date,
    transaction_date,
    type,
    description,
    amount,
    vat,
    admin_fee,
    service_fee,
    status,
    project_id,
    employee_id,
    category_id,
    subcategory_id,
    vendor_id,
    business_unit,
    department,
    payment_method,
    due_date,
    document_url,
    ocr_scanned,
    ocr_confidence,
    ocr_scanned_at,
    created_by
  )
  VALUES (
    (p_payload->>'submission_date')::date,
    (p_payload->>'transaction_date')::date,
    p_payload->>'type',
    nullif(p_payload->>'description', ''),
    coalesce(nullif(p_payload->>'amount', ''), '0')::numeric,
    coalesce(nullif(p_payload->>'vat', ''), '0')::numeric,
    coalesce(nullif(p_payload->>'admin_fee', ''), '0')::numeric,
    coalesce(nullif(p_payload->>'service_fee', ''), '0')::numeric,
    'Draft',
    nullif(p_payload->>'project_id', '')::uuid,
    nullif(p_payload->>'employee_id', '')::uuid,
    nullif(p_payload->>'category_id', '')::uuid,
    nullif(p_payload->>'subcategory_id', '')::uuid,
    nullif(p_payload->>'vendor_id', '')::uuid,
    nullif(p_payload->>'business_unit', ''),
    nullif(p_payload->>'department', ''),
    nullif(p_payload->>'payment_method', ''),
    nullif(p_payload->>'due_date', '')::date,
    nullif(p_payload->>'document_url', ''),
    coalesce((p_payload->>'ocr_scanned')::boolean, false),
    nullif(p_payload->>'ocr_confidence', '')::numeric,
    nullif(p_payload->>'ocr_scanned_at', '')::timestamptz,
    v_user_id
  )
  RETURNING id, ref_no, updated_at
  INTO v_expense_id, v_ref_no, v_updated_at;

  v_submit := public.submit_expense(v_expense_id, v_updated_at);
  IF coalesce((v_submit->>'success')::boolean, false) = false THEN
    RETURN v_submit || jsonb_build_object('expense_id', v_expense_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_expense_id,
    'ref_no', v_ref_no,
    'status', coalesce(v_submit->>'status', ''),
    'message', coalesce(v_submit->>'message', '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_submit_expense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_and_submit_expense(jsonb) TO authenticated;
