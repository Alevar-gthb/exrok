# Exrok — Patch: PRD/FSD Compliance Update

## File yang berubah / baru

### Update (replace file lama)

- `src/components/expense-form.tsx` — tambah Category, Subcategory, Vendor, Business Unit, Department, Payment Method, Due Date + mobile responsive grid
- `src/lib/validations/expense.schema.ts` — Zod schema untuk semua field baru
- `app/(dashboard)/inventory/page.tsx` — form tambah item, serial number, consumable stock (initial/last)
- `app/(dashboard)/reports/page.tsx` — sambungkan tombol export ke API nyata

### File baru

- `src/components/export-button.tsx` — client component download Excel
- `app/api/cron/payroll/route.ts` — cron job payroll tanggal 25
- `app/api/reports/export/route.ts` — export Excel via ExcelJS
- `src/supabase/migrations/007_inventory_lending.sql` — serial_number, initial_stock, last_stock, tabel item_loans
- `.env.local.example` — tambah CRON_SECRET

## Cara apply

1. Replace file yang berubah ke project lokal
2. Jalankan `007_inventory_lending.sql` di Supabase SQL Editor
3. Tambah `CRON_SECRET` ke `.env.local` dan Railway env vars
4. Railway Cron setup:
  - Schedule: `0 0 25 * *`
  - Command: `curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/payroll -H "x-cron-secret: $CRON_SECRET"`