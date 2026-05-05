# Exrok — Deployment Checklist

Ikuti urutan ini secara tepat. Jangan lompat langkah.

---

## STEP 1 · Supabase Project Setup (5 menit)

1. Buka [https://supabase.com](https://supabase.com) → New project
2. Catat: **Project URL** dan **Anon Key** (Project Settings → API)
3. Isi `.env.local`:
  ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   NEXT_PUBLIC_APP_URL=https://your-app.railway.app
  ```

---

## STEP 2 · Jalankan SQL Migrations (urutan wajib)

Buka **Supabase Dashboard → SQL Editor**, jalankan file-file ini **satu per satu** sesuai urutan:

### 001 — Schema (tabel utama)

Salin isi dari `DEVELOPMENT_GUIDE.md` (bagian SQL Schema) dan jalankan.

### 002 — RLS Policies

```
supabase/migrations/002_rls_policies.sql
```

### 003 — Audit Triggers

```
supabase/migrations/003_audit_triggers.sql
```

---

## STEP 3 · Supabase Auth

1. Dashboard → **Authentication → Providers** → pastikan **Email** enabled
2. Dashboard → **Authentication → URL Configuration**:
  - Site URL: `https://your-app.railway.app`
  - Redirect URLs tambahkan: `https://your-app.railway.app/auth/callback`

---

## STEP 4 · Supabase Storage

1. Dashboard → **Storage → New bucket**
2. Nama: `expense-documents`
3. Public: **Ya** (agar URL dokumen bisa ditampilkan)
4. Tambahkan policy di bucket:
  - **SELECT**: `authenticated` bisa baca
  - **INSERT**: `authenticated` bisa upload ke folder `{user_id}/`

SQL untuk storage policy (jalankan di SQL Editor):

```sql
CREATE POLICY "storage_expense_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND auth.role() = 'authenticated');

CREATE POLICY "storage_expense_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## STEP 5 · Tambah User Pertama (Owner)

Karena signup publik tidak ada, tambahkan user manual:

1. Supabase Dashboard → **Authentication → Users → Add user**
2. Isi email & password
3. Jalankan SQL ini untuk mendaftarkannya sebagai karyawan:

```sql
INSERT INTO employees (full_name, email, salary_amount, role, status)
VALUES ('Nama Anda', 'email@roketin.com', 0, 'owner', 'Active');
```

---

## STEP 6 · Install & Run Lokal

```bash
npm install
cp .env.local.example .env.local
# Isi nilai di .env.local

npm run dev
# Buka http://localhost:3000
# → akan redirect ke /login
# → login dengan email/password dari Step 5
```

---

## STEP 7 · Deploy ke Railway

```bash
# 1. Push ke GitHub
git add . && git commit -m "feat: Exrok MVP" && git push

# 2. Buka https://railway.app → New Project → Deploy from GitHub
# 3. Pilih repository Exrok
# 4. Railway auto-detect Next.js

# 5. Set environment variables di Railway:
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SUPABASE_SERVICE_ROLE_KEY
#    NEXT_PUBLIC_APP_URL  (isi URL Railway yang digenerate)

# 6. Deploy → tunggu build selesai (~2-3 menit)
```

---

## STEP 8 · Generate TypeScript Types (opsional tapi direkomendasikan)

Setelah database aktif, jalankan untuk type-safety penuh:

```bash
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  > supabase/database.types.ts
```

Untuk alur lokal yang konsisten dengan CI, gunakan:

```bash
npm run db:typegen
npm run db:typecheck
```

---

## Verifikasi MVP Berjalan

Checklist setelah deploy:

- `/login` muncul tanpa error
- Login berhasil, redirect ke `/expenses`
- Sidebar muncul dengan nama user & role
- Halaman `/expenses` menampilkan tabel (kosong = normal)
- Klik "Ajukan Expense" → form terbuka
- Isi form, submit → muncul di tabel dengan status "Menunggu"
- Login sebagai owner → tombol "Setujui/Tolak" muncul
- Approve → status berubah ke "Disetujui"
- Upload file → file muncul di Supabase Storage

---

## File yang dihasilkan (ringkasan)

```
app/
├── (auth)/login/page.tsx          ← Halaman login
├── auth/callback/route.ts         ← Callback Supabase Auth
├── (dashboard)/
│   ├── layout.tsx                 ← Shell sidebar + guard auth
│   ├── expenses/
│   │   ├── page.tsx               ← Daftar expense + filter
│   │   └── new/page.tsx           ← Form ajukan expense

src/
├── components/
│   ├── sidebar-client.tsx         ← Sidebar navigasi
│   ├── expense-form.tsx           ← Form input expense
│   └── expense-table.tsx          ← Tabel + filter + approval
├── lib/
│   ├── actions/expense.actions.ts ← insertExpense, upload, updateStatus
│   ├── validations/expense.schema.ts
│   ├── compress-file.ts
│   └── decimal.ts

supabase/
├── client.ts
├── server.ts
├── database.types.ts
└── migrations/
    ├── 002_rls_policies.sql       ← RLS semua tabel
    └── 003_audit_triggers.sql     ← Audit log triggers
```

