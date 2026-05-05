-- ============================================================
-- DARURAT / DEBUG SAJA — jangan dijalankan di production kecuali
-- Anda sadar SEMUA user terautentikasi bisa SELECT semua baris
-- di tabel ini lewat API (PostgREST).
--
-- Menonaktifkan RLS hanya pada `employees` biasanya sudah cukup
-- untuk menghilangkan 42P17, karena policy lain memanggil
-- get_my_role() / get_my_employee_id() yang membaca `employees`.
--
-- Setelah verifikasi, jalankan: re_enable_employees_rls.sql
-- lalu terapkan migrasi perbaikan permanen di repo.
-- ============================================================

ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- Opsional (hanya jika masih error setelah baris di atas): buka komentar
-- ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
