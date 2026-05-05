-- Mengaktifkan kembali RLS pada employees (policy yang ada tetap dipakai).

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
