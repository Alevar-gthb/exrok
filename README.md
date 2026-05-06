# Exrok — Integrated Expense & Inventory System

Roketin & Spacehub Internal Ops Platform

## Tech Stack

- **Framework:** Next.js 14+ (App Router) + TypeScript
- **Backend/Auth:** Supabase
- **Hosting:** Vercel
- **Styling:** Tailwind CSS (inline styles)

## Quick Start

### 1. Install

```bash
npm install
cp .env.local.example .env.local
# Isi SUPABASE_URL dan ANON_KEY di .env.local
```

### 2. Setup Database (Supabase SQL Editor)

Jalankan berurutan:

1. `src/supabase/migrations/001_schema.sql`
2. `src/supabase/migrations/002_rls_policies.sql`
3. `src/supabase/migrations/003_audit_triggers.sql`
4. `src/supabase/migrations/004_storage_policies.sql` *(setelah buat bucket)*

### 3. Setup Supabase

- Auth → Email provider: ON
- Storage → buat bucket `expense-documents` (public)
- Auth → URL Configuration → tambah URL Vercel (production + preview)

### 4. Buat user pertama (Owner)

Di Supabase Dashboard → Authentication → Add user, lalu:

```sql
INSERT INTO employees (full_name, email, salary_amount, role, status)
VALUES ('Nama Anda', 'email@anda.com', 0, 'owner', 'Active');
```

### 5. Run

```bash
npm run dev
```

## Schema-Types Guard (recommended)

Before opening PR, run:

```bash
npm run db:typegen
npm run db:typecheck
```

This checks:

- migration/schema drift via `supabase db diff --local`
- generated types freshness in `src/supabase/database.types.ts`
- critical Zod expense fields sync (`category_id`, `vendor_id`, `business_unit`, etc.)

Lihat `DEPLOY_CHECKLIST.md` untuk panduan deploy ke Vercel.