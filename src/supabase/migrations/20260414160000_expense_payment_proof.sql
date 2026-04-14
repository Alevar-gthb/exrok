-- Bukti pembayaran saat finance menandai expense sebagai Paid
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

COMMENT ON COLUMN expenses.payment_proof_url IS 'URL file bukti pembayaran (storage) setelah status Paid';
