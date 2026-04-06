-- ============================================================
-- supabase/migrations/002_rls_policies.sql
-- Row Level Security untuk semua tabel Exrok
-- Jalankan di Supabase SQL Editor SETELAH 001_schema.sql
-- ============================================================

-- ─── ENABLE RLS ───────────────────────────────────────────────
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- ─── HELPER: ambil role dari tabel employees ──────────────────
-- Fungsi ini dipanggil di setiap policy, bukan disimpan di JWT
-- agar perubahan role langsung berlaku tanpa re-login.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1;
$$;

-- ─── TABLE: employees ─────────────────────────────────────────

-- Owner & Finance: lihat semua karyawan
CREATE POLICY "employees_select_privileged"
ON employees FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

-- Staff & GA: hanya lihat data diri sendiri
CREATE POLICY "employees_select_own"
ON employees FOR SELECT
USING (
  get_my_role() IN ('staff', 'ga')
  AND email = auth.jwt() ->> 'email'
);

-- Hanya owner yang bisa insert/update/delete karyawan
CREATE POLICY "employees_insert_owner"
ON employees FOR INSERT
WITH CHECK (get_my_role() = 'owner');

CREATE POLICY "employees_update_owner"
ON employees FOR UPDATE
USING (get_my_role() = 'owner');

CREATE POLICY "employees_delete_owner"
ON employees FOR DELETE
USING (get_my_role() = 'owner');

-- ─── TABLE: projects ──────────────────────────────────────────

-- Semua user bisa lihat proyek aktif
CREATE POLICY "projects_select_all"
ON projects FOR SELECT
USING (auth.role() = 'authenticated');

-- Owner & Finance bisa kelola proyek
CREATE POLICY "projects_write_privileged"
ON projects FOR ALL
USING (get_my_role() IN ('owner', 'finance'))
WITH CHECK (get_my_role() IN ('owner', 'finance'));

-- ─── TABLE: expenses ──────────────────────────────────────────

-- Owner & Finance: lihat semua expense
CREATE POLICY "expenses_select_privileged"
ON expenses FOR SELECT
USING (get_my_role() IN ('owner', 'finance'));

-- Staff & GA: hanya lihat expense milik sendiri
CREATE POLICY "expenses_select_own"
ON expenses FOR SELECT
USING (
  get_my_role() IN ('staff', 'ga')
  AND created_by = auth.uid()
);

-- Semua user terautentikasi bisa buat expense
CREATE POLICY "expenses_insert_authenticated"
ON expenses FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND created_by = auth.uid()
);

-- Staff hanya bisa update expense milik sendiri yang masih Draft
CREATE POLICY "expenses_update_own_draft"
ON expenses FOR UPDATE
USING (
  created_by = auth.uid()
  AND status = 'Draft'
);

-- Owner & Finance bisa update expense apapun (untuk approval)
CREATE POLICY "expenses_update_privileged"
ON expenses FOR UPDATE
USING (get_my_role() IN ('owner', 'finance'));

-- Hanya owner yang bisa hapus expense
CREATE POLICY "expenses_delete_owner"
ON expenses FOR DELETE
USING (get_my_role() = 'owner');

-- ─── TABLE: inventory_items ───────────────────────────────────

-- Semua user bisa lihat inventaris
CREATE POLICY "inventory_select_all"
ON inventory_items FOR SELECT
USING (auth.role() = 'authenticated');

-- Owner & GA bisa kelola inventaris
CREATE POLICY "inventory_write_privileged"
ON inventory_items FOR ALL
USING (get_my_role() IN ('owner', 'ga'))
WITH CHECK (get_my_role() IN ('owner', 'ga'));

-- ─── TABLE: audit_logs ────────────────────────────────────────

-- Hanya owner yang bisa baca audit log
CREATE POLICY "audit_logs_select_owner"
ON audit_logs FOR SELECT
USING (get_my_role() = 'owner');

-- Tidak ada user yang bisa insert/update/delete manual
-- (hanya trigger database yang boleh menulis ke sini)
