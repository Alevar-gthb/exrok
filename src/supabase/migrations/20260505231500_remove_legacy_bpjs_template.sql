-- ============================================================
-- 20260505231500_remove_legacy_bpjs_template.sql
-- Hapus row legacy `salary_component_templates.code = 'BPJS'`
-- (label "potongan BPJS") yang sebenarnya redundant dengan
-- BPJS_TK_KARYAWAN, BPJS_KS_KARYAWAN, dan BPJS_DIPOTONG_PERUSAHAAN.
--
-- Idempotent: hanya hapus jika row tersebut belum dipakai di
-- employee_salary_component_amounts. Aman untuk dijalankan ulang
-- atau di-apply pada environment yang tidak punya row ini.
-- ============================================================

DELETE FROM salary_component_templates t
WHERE upper(t.code) = 'BPJS'
  AND NOT EXISTS (
    SELECT 1 FROM employee_salary_component_amounts esca
    WHERE esca.template_id = t.id
  );
