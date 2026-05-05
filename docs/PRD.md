# Product Requirements Document (PRD)

## 1. Ringkasan Produk

Exrok adalah aplikasi operasional internal untuk mengelola proses finance, HR, approval, payroll, reimbursement, inventory, dan reporting dalam satu alur kerja terintegrasi. Produk ini memusatkan pencatatan transaksi, kontrol approval berbasis rule, dan visibilitas laporan lintas modul.

## 2. Latar Belakang dan Tujuan

### 2.1 Latar Belakang

- Proses expense, approval, payroll, dan reimbursement sebelumnya tersebar dan sulit ditrace end-to-end.
- Diperlukan pemisahan hak akses per peran (`owner`, `finance`, `ga`, `staff`) dengan audit trail.
- Dibutuhkan integrasi cepat dari input transaksi ke status akhir pembayaran dan laporan.

### 2.2 Tujuan Produk

- Menyediakan alur expense dari draft sampai paid dengan kontrol approval yang konsisten.
- Menyatukan payroll run dengan pembentukan expense salary secara otomatis.
- Memungkinkan batching reimbursement untuk mempercepat settlement.
- Menyediakan laporan operasional dan finansial yang dapat difilter.
- Menjaga keamanan data dengan kombinasi role guard, server action checks, dan RLS.

### 2.3 Non-Tujuan

- Bukan sistem akuntansi GL penuh.
- Bukan sistem procurement kompleks multi-step.
- Bukan HRIS komprehensif (fokus pada data karyawan untuk kebutuhan finance/payroll).

## 3. Persona dan Peran

### 3.1 Persona Utama

- **Owner**: pengambil keputusan, konfigurasi rule, kontrol akses, governance.
- **Finance**: operator pembayaran, payroll, reimbursement, reporting.
- **GA**: operasional pengeluaran tertentu, inventory support, data pendukung.
- **Staff**: submit expense pribadi dan memantau statusnya.

### 3.2 Matriks Akses Produk (Ringkas)

- **Owner**: akses penuh dashboard, approval rules CRUD, users settings, project settings, payroll management, reimbursement batch, reports, mark paid.
- **Finance**: payroll management, reimbursement batch, reports, mark paid, approval processing sesuai kebijakan.
- **GA**: akses operasional terbatas ke modul expense/inventory/settings tertentu; tetap dibatasi oleh server-side checks dan RLS.
- **Staff**: create/edit expense sendiri (pada kondisi status tertentu), submit, lihat status, lihat riwayat terkait.

## 4. Ruang Lingkup Fitur

### 4.1 Modul Dashboard dan Sesi

- Validasi user login untuk akses area dashboard.
- Resolusi profil employee aktif melalui helper RPC.
- Sidebar/menu ditampilkan sesuai role.

### 4.2 Modul Expense

- Pembuatan expense manual.
- Pembuatan expense dengan dokumen (upload ke storage).
- Validasi file (JPG/PNG/PDF, maksimal 2MB).
- OCR receipt melalui API terpisah.
- Submit expense melalui rule engine.
- Detail expense, edit expense pada status tertentu, dan update paid oleh role berwenang.

### 4.3 Modul Approval

- Inbox approval untuk approver yang ditugaskan.
- Proses approve/reject satuan.
- Proses approve/reject bulk.
- Penyimpanan catatan approval dan histori status.

### 4.4 Modul Payroll

- Pembuatan payroll run per periode.
- Edit line item payroll selama status run masih `draft`.
- Import workbook payroll (`dry-run` dan `commit`).
- Submit payroll run untuk membuat expense salary.
- Penguncian run setelah `submitted`.

### 4.5 Modul Reimbursement

- Seleksi expense approved yang memenuhi syarat batch.
- Pembuatan reimbursement batch dengan metadata pembayaran.
- Pelacakan nomor batch, total amount, dan item dalam batch.

### 4.6 Modul Reporting

- Laporan ringkas dashboard.
- Laporan expenses.
- Laporan payments.
- Laporan payroll.
- Laporan reimbursement.
- Dukungan filter dimensi bisnis dan sorting tabel.

### 4.7 Modul Master Data dan Settings

- User management (role-based, terutama owner).
- Approval rules management.
- Projects management.
- Vendors management.
- Salary components management.
- Expense categories/subcategories.

### 4.8 Modul Employee dan Compensation

- Daftar employee dan detail employee.
- Kontrak employee.
- Assignment employee ke project.
- Konfigurasi komponen salary per employee.

### 4.9 Modul Inventory

- Master inventory item (Asset/Consumable).
- Riwayat peminjaman item (item loans).
- Keterkaitan item dengan expense sumber pengadaan.

## 5. Alur Pengguna End-to-End

### 5.1 Alur Expense sampai Paid

1. User membuat expense (draft) dan opsional mengunggah dokumen.
2. User submit expense.
3. Sistem mencocokkan approval rule aktif.
4. Jika auto-approve, status menjadi `Approved`; jika perlu approver, status `Pending Approval`.
5. Approver memproses approve/reject.
6. Finance/owner menandai `Paid` dengan tanggal dan bukti bayar.

### 5.2 Alur Approval

1. Approver membuka inbox approval.
2. Memilih item tunggal atau bulk.
3. Menjalankan approve/reject dengan catatan opsional.
4. Status expense dan approval tercermin di laporan/detail.

### 5.3 Alur Payroll ke Expense Salary

1. Finance/owner membuat payroll run.
2. Meninjau/mengedit payroll lines.
3. Submit payroll run.
4. Sistem membuat expense tipe `Salary` per line yang belum memiliki `expense_id`.
5. Run diubah menjadi `submitted`.

### 5.4 Alur Reimbursement Batch

1. Finance/owner memilih expense approved yang eligible.
2. Mengisi metadata batch (tanggal, metode, referensi, notes).
3. Menjalankan proses create batch.
4. Sistem mencatat batch header dan items, serta total amount.

## 6. Business Rules dan Constraints

### 6.1 Status Rules

- Expense dibuat dengan status awal `Draft`.
- Submit hanya valid untuk `Draft`.
- Edit own expense hanya diperbolehkan pada status `Draft` atau `Rejected`.
- Mark paid hanya boleh dari status `Approved` dan wajib ada `payment_date` + `payment_proof_url`.
- Payroll run hanya dapat dimodifikasi ketika `draft`.

### 6.2 Role Rules

- Operasi payroll dan reimbursement dibatasi `owner`/`finance`.
- Pengelolaan approval rules dibatasi `owner`.
- Proses pembayaran/mark paid dibatasi `owner`/`finance`.
- Akses data tetap difinalkan oleh RLS di database.

### 6.3 Validasi dan Input Rules

- Upload dokumen expense: tipe file terbatas dan ukuran maksimal.
- OCR endpoint memiliki rate limit per user.
- Import payroll validasi tahun, mode import, dan toleransi mismatch.

## 7. Requirement Fungsional (FR)

- **FR-01**: Sistem harus memvalidasi sesi user sebelum akses dashboard.
- **FR-02**: Sistem harus memungkinkan pembuatan expense dengan field finansial terstruktur.
- **FR-03**: Sistem harus mendukung upload dokumen expense ke storage publik terkontrol.
- **FR-04**: Sistem harus mengeksekusi submit expense melalui RPC rule engine.
- **FR-05**: Sistem harus membentuk record approval ketika rule memerlukan approver.
- **FR-06**: Sistem harus mendukung approve/reject single dan bulk.
- **FR-07**: Sistem harus mengizinkan owner/finance menandai expense paid dengan bukti.
- **FR-08**: Sistem harus mendukung pembuatan payroll run periodik.
- **FR-09**: Sistem harus menghasilkan expense salary saat payroll run disubmit.
- **FR-10**: Sistem harus mendukung pembuatan reimbursement batch dari kumpulan expense.
- **FR-11**: Sistem harus menampilkan laporan lintas modul dengan filter.
- **FR-12**: Sistem harus menyimpan audit untuk perubahan data penting.

## 8. Requirement Non-Fungsional (NFR)

- **NFR-01 Security**: Enforce role checks pada route/action + RLS di tabel inti.
- **NFR-02 Auditability**: Perubahan entitas penting tercatat di audit logs/triggers.
- **NFR-03 Data Integrity**: Status transitions dan constraints harus konsisten.
- **NFR-04 Reliability**: Alur critical (submit expense, process approval, batch reimbursement, submit payroll) harus mengembalikan error deterministik.
- **NFR-05 Performance**: Query laporan dan tabel utama harus tetap responsif untuk operasional harian.
- **NFR-06 Maintainability**: Konvensi naming status/role konsisten lintas UI, server actions, RPC, dan schema.

## 9. KPI dan Success Metrics

- Rasio expense yang berhasil disubmit tanpa rollback.
- Waktu median dari `Pending Approval` ke `Approved/Rejected`.
- Waktu median dari `Approved` ke `Paid`.
- Rasio keberhasilan payroll import (`commit`) per periode.
- Jumlah reimburse batch yang selesai per bulan.
- Jumlah error operasional kritikal per minggu (approval/payroll/reimburse APIs).

## 10. Acceptance Criteria Tingkat Produk

- Seluruh modul utama dapat diakses sesuai role dan tidak membuka operasi terlarang.
- Alur expense -> approval -> paid berjalan tanpa manipulasi status manual.
- Submit payroll menghasilkan expense salary dan menutup run ke `submitted`.
- Reimbursement batch menghasilkan header + item + total secara konsisten.
- Laporan merefleksikan status transaksi aktual sesuai filter.

## 11. Risiko dan Mitigasi

- **Drift schema vs types**: beberapa kolom/tabel terindikasi ada di types namun tidak terlihat di migration yang tersedia.
  - Mitigasi: dokumentasikan asumsi eksplisit pada ERD/FSD dan validasi berkala terhadap schema aktual.
- **Ketergantungan RPC + SECURITY DEFINER**:
  - Mitigasi: standardisasi review fungsi SQL, regression test untuk helper auth/role.
- **Kompleksitas RLS**:
  - Mitigasi: sediakan runbook operasional dan SQL emergency scripts terkontrol.

## 12. Dependensi Teknis

- Next.js App Router untuk UI/dashboard.
- Supabase Auth, Database, Storage, RPC.
- SQL migrations untuk evolusi schema dan RLS policies.
- Integrasi OCR via Anthropic API (env `ANTHROPIC_API_KEY`).

## 13. Out of Scope Fase Dokumen Ini

- Desain UI visual detail per layar.
- Strategi deployment/infrastruktur cloud detail.
- Integrasi ERP/accounting eksternal.