export type ComponentKind = 'earning' | 'deduction'

export type ColumnComponentMap = {
  header: string
  code: string
  label: string
  kind: ComponentKind
}

/**
 * @deprecated Source of truth untuk mapping header Excel sekarang ada di kolom
 * `excel_aliases` pada tabel `salary_component_templates`. List ini dipertahankan
 * sebagai seed historis untuk migration `20260505230000_salary_component_excel_aliases.sql`
 * dan sebagai referensi waktu dokumentasi. Importer payroll TIDAK lagi membaca
 * konstanta ini — gunakan `loadComponentMap` di `src/lib/payroll-import/importer.ts`.
 * Kelola alias komponen baru lewat halaman Settings → Salary Components.
 */
export const PAYROLL_COMPONENT_COLUMN_MAP: ColumnComponentMap[] = [
  { header: 'Gaji Pokok', code: 'BASE', label: 'Gaji pokok', kind: 'earning' },
  { header: 'Tunj Jabatan', code: 'TUNJ_JABATAN', label: 'Tunjangan jabatan', kind: 'earning' },
  { header: 'Tunj Makan', code: 'TUNJ_MAKAN', label: 'Tunjangan makan', kind: 'earning' },
  { header: 'Tunj Transport', code: 'TUNJ_TRANSPORT', label: 'Tunjangan transport', kind: 'earning' },
  { header: 'Tunj Performa', code: 'TUNJ_PERFORMA', label: 'Tunjangan performa', kind: 'earning' },
  { header: 'Tunj \nInternet', code: 'TUNJ_INTERNET', label: 'Tunjangan internet', kind: 'earning' },
  { header: 'Tunj Laptop', code: 'TUNJ_LAPTOP', label: 'Tunjangan laptop', kind: 'earning' },
  { header: 'Tunj Keluarga', code: 'TUNJ_KELUARGA', label: 'Tunjangan keluarga', kind: 'earning' },
  { header: 'Tunj Kesehatan', code: 'TUNJ_KESEHATAN', label: 'Tunjangan kesehatan', kind: 'earning' },
  { header: 'Tunj Lainnya', code: 'TUNJ_LAINNYA', label: 'Tunjangan lainnya', kind: 'earning' },
  { header: 'Benefit Kartap', code: 'BENEFIT_KARTAP', label: 'Benefit karyawan tetap', kind: 'earning' },
  { header: 'Kompensasi Berjalan', code: 'KOMPENSASI_BERJALAN', label: 'Kompensasi berjalan', kind: 'earning' },
  { header: 'Kompensasi', code: 'KOMPENSASI', label: 'Kompensasi', kind: 'earning' },
  { header: 'Bonus', code: 'BONUS', label: 'Bonus', kind: 'earning' },
  { header: 'THR', code: 'THR', label: 'THR', kind: 'earning' },
  { header: 'Uang Lembur', code: 'LEMBUR', label: 'Uang lembur', kind: 'earning' },
  { header: 'JKK Perusahaan', code: 'JKK_PERUSAHAAN', label: 'JKK perusahaan', kind: 'earning' },
  { header: 'JKM Perusahaan', code: 'JKM_PERUSAHAAN', label: 'JKM perusahaan', kind: 'earning' },
  { header: 'JHT Perusahaan', code: 'JHT_PERUSAHAAN', label: 'JHT perusahaan', kind: 'earning' },
  { header: 'BPJS KS Perusahaan', code: 'BPJS_KS_PERUSAHAAN', label: 'BPJS kesehatan perusahaan', kind: 'earning' },
  { header: 'Reimbursement', code: 'REIMBURSEMENT', label: 'Reimbursement', kind: 'earning' },
  { header: 'BPJS TK Karyawan', code: 'BPJS_TK_KARYAWAN', label: 'BPJS TK karyawan', kind: 'deduction' },
  { header: 'BPJS KS Karyawan', code: 'BPJS_KS_KARYAWAN', label: 'BPJS KS karyawan', kind: 'deduction' },
  { header: 'PPh 21', code: 'PPH21', label: 'PPh 21', kind: 'deduction' },
  {
    header: 'BPJS yg Dipotong Perusahaan',
    code: 'BPJS_DIPOTONG_PERUSAHAAN',
    label: 'BPJS dipotong perusahaan',
    kind: 'deduction',
  },
  { header: 'Potongan Lain-Lain', code: 'POTONGAN_LAIN', label: 'Potongan lain-lain', kind: 'deduction' },
  { header: 'Biaya Admin', code: 'BIAYA_ADMIN', label: 'Biaya admin', kind: 'deduction' },
]

export const PAYROLL_REQUIRED_HEADERS = [
  'NPWP',
  'Nama Pegawai',
  'Status Pajak',
  'Status PTKP',
  'Penghasilan Bruto',
  'Kategori TER',
  'TER',
  'PPh 21',
  'THP',
  'Transfer',
]

export const PAYROLL_PROJECT_LIST_HEADER = 'Project List'
