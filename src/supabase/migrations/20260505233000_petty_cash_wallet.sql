-- ============================================================
-- Petty cash wallet (global) + atomic deduction on submit
-- ============================================================

CREATE TABLE IF NOT EXISTS public.petty_cash_wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'Main Petty Cash',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_wallet_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id uuid NOT NULL REFERENCES public.petty_cash_wallets(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN ('topup', 'expense', 'adjustment')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  balance_before numeric(15,2) NOT NULL DEFAULT 0 CHECK (balance_before >= 0),
  balance_after numeric(15,2) NOT NULL DEFAULT 0 CHECK (balance_after >= 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_wallet_entries_wallet_created_at
  ON public.petty_cash_wallet_entries (wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petty_cash_wallet_entries_reference
  ON public.petty_cash_wallet_entries (reference_type, reference_id);

ALTER TABLE public.petty_cash_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "petty_cash_wallets_select_owner_finance"
ON public.petty_cash_wallets
FOR SELECT
USING (public.request_my_role() = ANY (ARRAY['owner', 'finance']));

CREATE POLICY "petty_cash_wallet_entries_select_owner_finance"
ON public.petty_cash_wallet_entries
FOR SELECT
USING (public.request_my_role() = ANY (ARRAY['owner', 'finance']));

CREATE OR REPLACE FUNCTION public.get_active_petty_cash_wallet_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  SELECT id
  INTO v_wallet_id
  FROM public.petty_cash_wallets
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.petty_cash_wallets (name, is_active)
    VALUES ('Main Petty Cash', true)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_petty_cash_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_wallet_id uuid;
  v_balance numeric(15,2) := 0;
BEGIN
  v_role := public.request_my_role();
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['owner', 'finance'])) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Akses wallet petty cash ditolak'
    );
  END IF;

  v_wallet_id := public.get_active_petty_cash_wallet_id();

  SELECT coalesce(e.balance_after, 0)
  INTO v_balance
  FROM public.petty_cash_wallet_entries e
  WHERE e.wallet_id = v_wallet_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'balance', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.topup_petty_cash_wallet(
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_wallet_id uuid;
  v_before numeric(15,2) := 0;
  v_after numeric(15,2) := 0;
  v_user_id uuid;
BEGIN
  v_role := public.request_my_role();
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY['owner', 'finance'])) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Akses top-up petty cash ditolak'
    );
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_AMOUNT',
      'message', 'Nominal top-up harus lebih besar dari 0'
    );
  END IF;

  v_user_id := auth.uid();
  v_wallet_id := public.get_active_petty_cash_wallet_id();

  SELECT coalesce(e.balance_after, 0)
  INTO v_before
  FROM public.petty_cash_wallet_entries e
  WHERE e.wallet_id = v_wallet_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  v_after := v_before + p_amount;

  INSERT INTO public.petty_cash_wallet_entries (
    wallet_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    notes,
    created_by
  )
  VALUES (
    v_wallet_id,
    'topup',
    p_amount,
    v_before,
    v_after,
    'manual_topup',
    NULL,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'balance_before', v_before,
    'balance_after', v_after
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_petty_cash_for_expense(
  p_expense_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_before numeric(15,2) := 0;
  v_after numeric(15,2) := 0;
  v_user_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_AMOUNT',
      'message', 'Nominal pengeluaran petty cash tidak valid'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.petty_cash_wallet_entries
    WHERE reference_type = 'expense'
      AND reference_id = p_expense_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Wallet sudah terdebet untuk expense ini');
  END IF;

  v_user_id := auth.uid();
  v_wallet_id := public.get_active_petty_cash_wallet_id();

  SELECT coalesce(e.balance_after, 0)
  INTO v_before
  FROM public.petty_cash_wallet_entries e
  WHERE e.wallet_id = v_wallet_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  IF p_amount > v_before THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_EXPENSE_IS_CURRENT_WALLET',
      'message', 'Maksimal pengeluaran = wallet saat ini',
      'wallet_balance', v_before
    );
  END IF;

  v_after := v_before - p_amount;

  INSERT INTO public.petty_cash_wallet_entries (
    wallet_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    reference_id,
    notes,
    created_by
  )
  VALUES (
    v_wallet_id,
    'expense',
    p_amount,
    v_before,
    v_after,
    'expense',
    p_expense_id,
    'Auto-debit dari submit expense Petty Cash',
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'balance_before', v_before,
    'balance_after', v_after
  );
END;
$$;

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
  v_wallet_result jsonb;
BEGIN
  PERFORM set_config('request.my_employee_id', coalesce(public.request_my_employee_id()::text, ''), true);
  PERFORM set_config('request.my_role', coalesce(public.request_my_role(), ''), true);

  v_actor_role := public.request_my_role();

  SELECT *
  INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id
    AND (created_by = auth.uid() OR v_actor_role = ANY (ARRAY['owner', 'finance']))
  FOR UPDATE;

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
    v_wallet_result := public.consume_petty_cash_for_expense(p_expense_id, v_expense.total_payment);
    IF coalesce((v_wallet_result->>'success')::boolean, false) = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', coalesce(v_wallet_result->>'code', 'PETTY_CASH_ERROR'),
        'message', coalesce(v_wallet_result->>'message', 'Gagal memproses saldo petty cash')
          || coalesce(' (saldo saat ini: Rp ' || to_char((v_wallet_result->>'wallet_balance')::numeric, 'FM999G999G999G999D00') || ')', ''),
        'wallet_balance', v_wallet_result->'wallet_balance'
      );
    END IF;

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

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_petty_cash_wallet(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_petty_cash_for_expense(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_expense(uuid, timestamptz) TO authenticated;
