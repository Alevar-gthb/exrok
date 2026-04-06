#!/bin/bash
# ============================================================
# setup.sh — Jalankan sekali di folder project Exrok
# Usage: bash setup.sh
# ============================================================
set -e

echo ""
echo "▶ [1/4] Install dependencies..."
npm install

echo ""
echo "▶ [2/4] Copy env template..."
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "  → .env.local dibuat. ISI dulu sebelum lanjut:"
  echo "     NEXT_PUBLIC_SUPABASE_URL"
  echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "     SUPABASE_SERVICE_ROLE_KEY"
  echo ""
  read -p "  Sudah isi .env.local? Tekan Enter untuk lanjut..."
else
  echo "  → .env.local sudah ada, skip."
fi

echo ""
echo "▶ [3/4] Type check..."
npx tsc --noEmit && echo "  → TypeScript OK" || echo "  ⚠ Ada type error, cek output di atas"

echo ""
echo "▶ [4/4] Build test..."
npm run build && echo "  → Build sukses!" || echo "  ✗ Build gagal, cek error di atas"

echo ""
echo "✓ Setup selesai. Jalankan: npm run dev"
