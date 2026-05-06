-- ============================================================
-- 20260505230000_salary_component_excel_aliases.sql
-- Pindahkan mapping kolom Excel -> komponen gaji ke kolom DB.
-- Importer payroll mencocokkan header dinamis berdasarkan code,
-- label, dan excel_aliases. Header yang tidak dikenal otomatis
-- dibuatkan komponen baru saat import (commit) — alias-nya di-
-- generate dari header tersebut.
-- ============================================================

ALTER TABLE salary_component_templates
  ADD COLUMN IF NOT EXISTS excel_aliases text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN salary_component_templates.excel_aliases IS
  'Daftar header Excel yang dipetakan ke komponen ini. Importer payroll mencocokkan header sheet dengan nilai di kolom ini (case-insensitive, whitespace-normalized).';

CREATE INDEX IF NOT EXISTS idx_salary_template_excel_aliases
  ON salary_component_templates USING gin (excel_aliases);

-- Backfill alias dari mapping lama (idempotent: hanya isi kalau masih kosong).
UPDATE salary_component_templates
SET excel_aliases = CASE upper(code)
    WHEN 'BASE'                     THEN ARRAY['Gaji Pokok']
    WHEN 'TUNJ_JABATAN'             THEN ARRAY['Tunj Jabatan']
    WHEN 'TUNJ_MAKAN'               THEN ARRAY['Tunj Makan']
    WHEN 'TUNJ_TRANSPORT'           THEN ARRAY['Tunj Transport']
    WHEN 'TUNJ_PERFORMA'            THEN ARRAY['Tunj Performa']
    WHEN 'TUNJ_INTERNET'            THEN ARRAY[E'Tunj \nInternet', 'Tunj Internet']
    WHEN 'TUNJ_LAPTOP'              THEN ARRAY['Tunj Laptop']
    WHEN 'TUNJ_KELUARGA'            THEN ARRAY['Tunj Keluarga']
    WHEN 'TUNJ_KESEHATAN'           THEN ARRAY['Tunj Kesehatan']
    WHEN 'TUNJ_LAINNYA'             THEN ARRAY['Tunj Lainnya']
    WHEN 'BENEFIT_KARTAP'           THEN ARRAY['Benefit Kartap']
    WHEN 'KOMPENSASI_BERJALAN'      THEN ARRAY['Kompensasi Berjalan']
    WHEN 'KOMPENSASI'               THEN ARRAY['Kompensasi']
    WHEN 'BONUS'                    THEN ARRAY['Bonus']
    WHEN 'THR'                      THEN ARRAY['THR']
    WHEN 'LEMBUR'                   THEN ARRAY['Uang Lembur']
    WHEN 'JKK_PERUSAHAAN'           THEN ARRAY['JKK Perusahaan']
    WHEN 'JKM_PERUSAHAAN'           THEN ARRAY['JKM Perusahaan']
    WHEN 'JHT_PERUSAHAAN'           THEN ARRAY['JHT Perusahaan']
    WHEN 'BPJS_KS_PERUSAHAAN'       THEN ARRAY['BPJS KS Perusahaan']
    WHEN 'REIMBURSEMENT'            THEN ARRAY['Reimbursement']
    WHEN 'BPJS_TK_KARYAWAN'         THEN ARRAY['BPJS TK Karyawan']
    WHEN 'BPJS_KS_KARYAWAN'         THEN ARRAY['BPJS KS Karyawan']
    WHEN 'PPH21'                    THEN ARRAY['PPh 21']
    WHEN 'BPJS_DIPOTONG_PERUSAHAAN' THEN ARRAY['BPJS yg Dipotong Perusahaan']
    WHEN 'POTONGAN_LAIN'            THEN ARRAY['Potongan Lain-Lain']
    WHEN 'BIAYA_ADMIN'              THEN ARRAY['Biaya Admin']
    ELSE excel_aliases
  END
WHERE coalesce(array_length(excel_aliases, 1), 0) = 0;
