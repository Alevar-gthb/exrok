-- Bucket untuk bukti expense (upload dari createExpenseWithDocument / uploadExpenseDocument).
-- Per dashboard Supabase, bucket ini sebelumnya dibuat manual; migrasi ini menyamakan local & fresh deploy.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-documents',
  'expense-documents',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;
