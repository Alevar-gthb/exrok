-- ============================================================
-- 004_storage_policies.sql
-- Policy untuk Supabase Storage bucket "expense-documents"
-- Jalankan SETELAH membuat bucket di Supabase Dashboard
-- ============================================================

CREATE POLICY "storage_expense_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

CREATE POLICY "storage_expense_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
