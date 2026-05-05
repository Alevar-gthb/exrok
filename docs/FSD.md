# Functional Specification Document (FSD)

## 1. Tujuan dan Konteks

Dokumen ini merinci spesifikasi fungsional implementasi aplikasi Exrok berdasarkan arsitektur Next.js + Supabase yang saat ini berjalan. Fokus utama adalah jejak eksekusi dari UI hingga database untuk modul operasional inti.

## 2. Arsitektur Implementasi

## 2.1 Lapisan Sistem
- **Presentation layer**: App Router pages di `app/(dashboard)` dan komponen interaktif di `src/components`.
- **Application layer**: server actions di `src/lib/actions` sebagai orkestrasi validasi, role checks, dan pemanggilan RPC/database.
- **Data layer**: Supabase Postgres (tables, functions/RPC, RLS policies) + storage bucket untuk dokumen.
- **Integration layer**: API route untuk OCR receipt dan payroll import workbook.

## 2.2 Flow Umum Request
1. User membuka route dashboard.
2. Server melakukan validasi sesi dan resolusi employee context (`get_my_employee_record`).
3. UI men-trigger server action atau API route.
4. Server action mengecek role dan validasi payload.
5. Action menjalankan query SQL atau RPC.
6. Hasil dikembalikan sebagai `ActionResult`/JSON untuk update UI.

## 3. Definisi Role dan Otorisasi

- `owner`: akses governance penuh, termasuk approval rules management dan user settings.
- `finance`: operasi payroll, reimbursement batch, mark paid, dan pelaporan.
- `ga`: operasional tertentu (expense/inventory/settings terbatas), tetap tunduk server checks + RLS.
- `staff`: submit dan pemantauan expense pribadi.

Pendekatan keamanan:
- Guard di route/page (navigasi dan redirect).
- Guard di server action (hard authorization).
- Guard di DB policy (RLS) sebagai lini akhir.

## 4. Spesifikasi Modul

## 4.1 Dashboard dan Session Bootstrap

### Tujuan
Menyediakan konteks user/employee yang valid sebelum mengakses modul bisnis.

### Komponen Implementasi
- Route utama dashboard: `app/(dashboard)/dashboard/page.tsx`
- Layout dashboard: `app/(dashboard)/layout.tsx`
- Session helper: `src/lib/employee-session.ts`
- Sidebar role-aware: `src/components/sidebar-client.tsx`

### Alur Fungsional
1. Layout memanggil Supabase Auth untuk user saat ini.
2. Sistem memanggil RPC `get_my_employee_record`.
3. Jika context tidak valid, user diarahkan ulang/ditolak.
4. Sidebar menampilkan menu sesuai role.

### Failure Handling
- User tidak login -> unauthorized flow.
- Employee context gagal resolve -> blok akses dashboard.

## 4.2 Expense Management

### Tujuan
Mengelola transaksi expense dari input hingga status akhir.

### Komponen Implementasi
- Routes:
  - `app/(dashboard)/expenses/page.tsx`
  - `app/(dashboard)/expenses/new/page.tsx`
  - `app/(dashboard)/expenses/[id]/page.tsx`
  - `app/(dashboard)/expenses/[id]/edit/page.tsx`
- Components:
  - `src/components/expense-form.tsx`
  - `src/components/expense-table.tsx`
  - `src/components/expense-detail-client.tsx`
- Actions:
  - `src/lib/actions/expense.actions.ts`
- Tables:
  - `expenses`, `vendors`, dan relasi referensial master lainnya.

### Trigger dan Precondition
- User authenticated.
- Payload expense valid.
- Untuk mark paid: role `owner/finance`, status `Approved`, `paymentDate` valid, `paymentProofUrl` tersedia.

### Alur Inti
1. User submit form expense.
2. Action `insertExpense` membuat record `Draft` dengan `created_by = auth.uid()`.
3. Action memanggil RPC `submit_expense`.
4. Jika RPC gagal, expense hasil insert dihapus (rollback app-level).
5. Status hasil submit mengikuti output RPC (`Pending Approval` atau `Approved`).

### Upload Dokumen
- Upload dilakukan melalui helper storage action.
- File constraint:
  - MIME: JPG/PNG/PDF
  - Max size: 2MB
- URL dokumen disimpan pada `document_url`.

### Error Handling
- Auth invalid -> error unauthorized/sesi tidak valid.
- Validasi file gagal -> error format/ukuran.
- RPC error -> return gagal dan rollback data insert baru.
- Database error -> pesan error dari Supabase.

## 4.3 Approval Workflow

### Tujuan
Memproses keputusan approve/reject terhadap expense yang menunggu approval.

### Komponen Implementasi
- Routes/components:
  - `app/(dashboard)/dashboard/page.tsx`
  - `src/components/approvals-inbox-client.tsx`
- Actions:
  - `src/lib/actions/approval.actions.ts`
- RPC:
  - `submit_expense`
  - `process_approval`
  - `bulk_process_approval`
- Tables:
  - `approval_rules`, `expense_approvals`, `expenses`

### Precondition
- User authenticated.
- Approver cocok dengan assignment approval, atau role owner untuk override sesuai kebijakan.

### Alur
1. Expense disubmit dan rule matched.
2. Jika butuh approval manual, dibuat `expense_approvals` status `Pending`.
3. Approver melakukan approve/reject (single atau bulk).
4. RPC memperbarui:
  - `expense_approvals.status`
  - `expenses.status` menjadi `Approved` atau `Rejected`.

### Failure Handling
- Approval item tidak ditemukan.
- Approval sudah diproses sebelumnya.
- User tidak berhak memproses approval.

## 4.4 Reimbursement Batch

### Tujuan
Mengelompokkan expense reimburse yang eligible menjadi batch pembayaran.

### Komponen Implementasi
- Route/report:
  - `app/(dashboard)/reports/reimburse/page.tsx`
- Component:
  - `src/components/reimburse-report-client.tsx`
- Action:
  - `src/lib/actions/reimbursement.actions.ts`
- RPC:
  - `create_reimbursement_batch`
- Tables:
  - `reimbursement_batches`, `reimbursement_batch_items`, `expenses`

### Precondition
- User role `owner` atau `finance`.
- Minimal satu `expense_id` dipilih.

### Alur
1. User pilih daftar expense.
2. User mengisi metadata batch.
3. Action memanggil RPC `create_reimbursement_batch`.
4. RPC mengembalikan `batch_id`, `batch_no`, `processed_count`, `total_amount`.

### Failure Handling
- Daftar expense kosong.
- Unauthorized role.
- Error eksekusi RPC.

## 4.5 Payroll Management

### Tujuan
Mengelola payroll periodik dan menghasilkan expense salary secara sistematis.

### Komponen Implementasi
- Routes:
  - `app/(dashboard)/payroll/page.tsx`
  - `app/(dashboard)/payroll/[id]/page.tsx`
- Component:
  - `src/components/payroll-run-detail-client.tsx`
- Actions:
  - `src/lib/actions/payroll.actions.ts`
- API:
  - `app/api/payroll/import/route.ts`
- Tables:
  - `payroll_runs`, `payroll_run_lines`, `expenses`

### Precondition
- Role `owner/finance`.
- Run status `draft` untuk update/delete.

### Alur Payroll Run
1. Action `createPayrollRun` membuat run untuk periode.
2. User update line payroll selama run `draft`.
3. Submit run memproses line tanpa `expense_id`.
4. Untuk setiap line pending, action membuat expense `type = Salary`.
5. `payroll_run_lines.expense_id` diisi.
6. Run diubah menjadi `submitted`.

### Import Payroll Workbook
- API menerima:
  - `file` (`.xlsx`)
  - `year` (2000-2100)
  - `mode` (`dry-run` atau `commit`)
  - `mismatchTolerance`
- Hanya owner/finance.
- Hasil import dikembalikan sebagai summary.

### Failure Handling
- Run tidak ditemukan.
- Run bukan `draft`.
- Tidak ada line payroll.
- Gagal insert expense salary pada salah satu line.

## 4.6 Reporting

### Tujuan
Memberikan visibilitas transaksi lintas domain dengan filter operasional.

### Komponen Implementasi
- Routes:
  - `app/(dashboard)/reports/page.tsx`
  - `app/(dashboard)/reports/expenses/page.tsx`
  - `app/(dashboard)/reports/payments/page.tsx`
  - `app/(dashboard)/reports/payroll/page.tsx`
  - `app/(dashboard)/reports/reimburse/page.tsx`
- Components:
  - `src/components/expense-report-items-table.tsx`
  - `src/components/payments-report-table.tsx`
  - `src/components/payroll-report-lines-table.tsx`
  - `src/components/reimburse-report-client.tsx`

### Spesifikasi Fungsional
- Mendukung filter periodik dan dimensi bisnis utama.
- Mendukung sorting tabular untuk meningkatkan analisis.
- Menampilkan status final sesuai hasil proses approval/payment/payroll.

## 4.7 Master Data, Settings, dan Employee Domain

### Tujuan
Menyediakan konfigurasi dan data referensi untuk alur operasional utama.

### Komponen Implementasi
- Routes:
  - `app/(dashboard)/settings/users/page.tsx`
  - `app/(dashboard)/settings/projects/page.tsx`
  - `app/(dashboard)/settings/vendors/page.tsx`
  - `app/(dashboard)/settings/approval-rules/page.tsx`
  - `app/(dashboard)/settings/salary-components/page.tsx`
  - `app/(dashboard)/employees/page.tsx`
  - `app/(dashboard)/employees/[id]/page.tsx`
- Actions:
  - `src/lib/actions/approval-rules.actions.ts`

### Spesifikasi Fungsional
- Approval rules CRUD hanya owner.
- User/settings dimodulasi role.
- Data employee dan salary components menjadi referensi payroll.
- Projects dan vendors menjadi referensi expense.

## 4.8 Inventory dan Item Loans

### Tujuan
Mengelola aset/consumable dan peminjaman item.

### Komponen Implementasi
- Route:
  - `app/(dashboard)/inventory/page.tsx`
- Tabel:
  - `inventory_items`, `item_loans`

### Spesifikasi Fungsional
- Mencatat tipe inventory (`Asset`/`Consumable`).
- Menyimpan histori peminjaman dan status pengembalian.
- Menjaga keterkaitan dengan expense sumber pembelian (opsional).

## 5. Kontrak Integrasi (API dan RPC)

## 5.1 API OCR Receipt
- Endpoint: `app/api/ocr/receipt/route.ts`
- Method: `POST`
- Input: file receipt (multipart form data)
- Validasi:
  - auth wajib
  - MIME whitelist
  - max 2MB
  - rate limit 10 req/menit/user
- Integrasi eksternal: Anthropic Messages API
- Output: data OCR terstruktur + confidence

## 5.2 API Payroll Import
- Endpoint: `app/api/payroll/import/route.ts`
- Method: `POST`
- Input: `file`, `year`, `mode`, `mismatchTolerance`
- Validasi role: owner/finance
- Output: ringkasan hasil import

## 5.3 RPC Kontrak Utama
- `get_my_employee_record`: bootstrap context employee.
- `submit_expense`: transisi dari draft ke status approval/approved.
- `process_approval`: keputusan approval tunggal.
- `bulk_process_approval`: proses approval massal.
- `create_reimbursement_batch`: pembuatan batch reimbursement.

## 6. State Machine

## 6.1 Expense State Machine
- `Draft` -> `Pending Approval` (rule require approval)
- `Draft` -> `Approved` (auto-approve)
- `Pending Approval` -> `Approved` (approve action)
- `Pending Approval` -> `Rejected` (reject action)
- `Approved` -> `Paid` (mark paid by owner/finance with proof)
- `Rejected` -> dapat diedit dan disubmit ulang

## 6.2 Expense Approval State Machine
- `Pending` -> `Approved`
- `Pending` -> `Rejected`
- `Approved/Rejected` adalah terminal state pada record approval tersebut

## 6.3 Payroll Run State Machine
- `draft` -> `submitted`
- Setelah `submitted`, line update/delete run tidak diperbolehkan

## 7. Mapping Teknis Route ke Action dan Data

| Route Domain | Komponen Utama | Action/API/RPC | Tabel Utama |
| --- | --- | --- | --- |
| Expenses | `expense-form`, `expense-table`, `expense-detail-client` | `insertExpense`, `createExpenseWithDocument`, `markExpensePaid`, RPC `submit_expense` | `expenses`, `expense_approvals` |
| Approvals | `approvals-inbox-client` | `rpcProcessApproval`, `rpcBulkProcessApproval`, RPC `process_approval`, `bulk_process_approval` | `expense_approvals`, `expenses` |
| Payroll | `payroll-run-detail-client` | `createPayrollRun`, `updatePayrollRunLine`, `submitPayrollRun`, API payroll import | `payroll_runs`, `payroll_run_lines`, `expenses` |
| Reimburse | `reimburse-report-client` | `createReimbursementBatch`, RPC `create_reimbursement_batch` | `reimbursement_batches`, `reimbursement_batch_items`, `expenses` |
| Settings Approval Rules | approval rules settings clients | `createApprovalRule`, `updateApprovalRule`, `deleteApprovalRule` | `approval_rules` |
| OCR | expense form integrations | API OCR receipt | `ocr_audit_logs` (log), `expenses` (hasil terapan manual) |

## 8. Error Handling dan Observability

- Server action mengembalikan `ActionResult` konsisten (`success`, `data`, `error`).
- API route mengembalikan JSON dengan status code sesuai jenis error.
- Error eksternal (OCR provider) diterjemahkan menjadi respons server yang aman.
- Audit logs dan trigger SQL berfungsi sebagai jejak perubahan data kritis.

## 9. Keamanan dan Kepatuhan Data

- Semua alur sensitif mengandalkan validasi session auth.
- Role checks dijalankan sebelum operasi tulis penting.
- RLS menjaga boundary akses antar user/role pada lapisan DB.
- Helper function security definer dipakai untuk menghindari deadlock/rekursi policy tertentu.

## 10. Known Limitations dan Technical Debt

- Terdapat indikasi perbedaan antara schema migration dan type definitions pada beberapa kolom/tabel domain expense.
- Ketergantungan pada RPC + policy kompleks meningkatkan kebutuhan regression testing SQL.
- Sebagian page visibility ditopang kombinasi nav gating dan backend checks; perlu audit berkala untuk memastikan tidak ada privilege leak.

## 11. Asumsi Implementasi

- Environment produksi/staging memiliki migration tambahan yang tidak tercakup snapshot saat ini.
- Kolom referensial expense terhadap categories/subcategories/vendors tersedia di DB aktif.
- Nilai status dan role mengikuti kontrak tipe saat ini dan dijaga konsisten lintas modul.
