#!/bin/bash

# =============================================================================
# EXROK - Refactor Script
# Jalankan dari ROOT folder project: bash refactor-exrok.sh
# =============================================================================

set -e  # Hentikan jika ada error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  EXROK Refactor Script               ${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Pastikan dijalankan dari root project (ada folder app/)
if [ ! -d "app" ]; then
  echo -e "${RED}ERROR: Folder 'app/' tidak ditemukan.${NC}"
  echo -e "${RED}Pastikan script dijalankan dari ROOT folder project Next.js kamu.${NC}"
  exit 1
fi

# =============================================================================
# STEP 1: BUAT FOLDER TUJUAN JIKA BELUM ADA
# =============================================================================
echo -e "${YELLOW}[1/5] Membuat folder tujuan...${NC}"

mkdir -p "app/(dashboard)/settings/vendors"
mkdir -p "app/(dashboard)/settings/projects"
mkdir -p "app/(dashboard)/settings/approval-rules"
mkdir -p "app/(dashboard)/expenses/categories"

echo -e "${GREEN}  ✓ Folder tujuan siap${NC}"

# =============================================================================
# STEP 2: PINDAHKAN FILE
# =============================================================================
echo -e "${YELLOW}[2/5] Memindahkan file...${NC}"

# vendors
if [ -f "app/(dashboard)/vendors/page.tsx" ]; then
  cp "app/(dashboard)/vendors/page.tsx" "app/(dashboard)/settings/vendors/page.tsx"
  echo -e "${GREEN}  ✓ vendors/page.tsx → settings/vendors/page.tsx${NC}"
else
  echo -e "${YELLOW}  ! app/(dashboard)/vendors/page.tsx tidak ditemukan, skip${NC}"
fi

# projects
if [ -f "app/(dashboard)/projects/page.tsx" ]; then
  cp "app/(dashboard)/projects/page.tsx" "app/(dashboard)/settings/projects/page.tsx"
  echo -e "${GREEN}  ✓ projects/page.tsx → settings/projects/page.tsx${NC}"
else
  echo -e "${YELLOW}  ! app/(dashboard)/projects/page.tsx tidak ditemukan, skip${NC}"
fi

# categories
if [ -f "app/(dashboard)/categories/page.tsx" ]; then
  cp "app/(dashboard)/categories/page.tsx" "app/(dashboard)/expenses/categories/page.tsx"
  echo -e "${GREEN}  ✓ categories/page.tsx → expenses/categories/page.tsx${NC}"
else
  echo -e "${YELLOW}  ! app/(dashboard)/categories/page.tsx tidak ditemukan, skip${NC}"
fi

# approvals → approval-rules (hanya jika tujuan belum ada atau kosong)
if [ -f "app/(dashboard)/approvals/page.tsx" ]; then
  if [ -f "app/(dashboard)/settings/approval-rules/page.tsx" ]; then
    echo -e "${YELLOW}  ! settings/approval-rules/page.tsx sudah ada, skip copy (akan hapus folder lama saja)${NC}"
  else
    cp "app/(dashboard)/approvals/page.tsx" "app/(dashboard)/settings/approval-rules/page.tsx"
    echo -e "${GREEN}  ✓ approvals/page.tsx → settings/approval-rules/page.tsx${NC}"
  fi
else
  echo -e "${YELLOW}  ! app/(dashboard)/approvals/page.tsx tidak ditemukan, skip${NC}"
fi

# =============================================================================
# STEP 3: BUAT settings/page.tsx (redirect)
# =============================================================================
echo -e "${YELLOW}[3/5] Membuat settings/page.tsx...${NC}"

cat > "app/(dashboard)/settings/page.tsx" << 'EOF'
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  redirect('/settings/vendors')
}
EOF

echo -e "${GREEN}  ✓ settings/page.tsx dibuat${NC}"

# =============================================================================
# STEP 4: UPDATE SEMUA INTERNAL LINKS
# =============================================================================
echo -e "${YELLOW}[4/5] Mengupdate semua referensi path lama di codebase...${NC}"

# Fungsi untuk replace string di semua file .tsx dan .ts
replace_in_files() {
  local old="$1"
  local new="$2"
  local label="$3"

  # Gunakan find + sed untuk kompatibilitas macOS & Linux
  local count=0
  while IFS= read -r -d '' file; do
    if grep -q "$old" "$file" 2>/dev/null; then
      # macOS & Linux compatible sed
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|${old}|${new}|g" "$file"
      else
        sed -i "s|${old}|${new}|g" "$file"
      fi
      count=$((count + 1))
      echo -e "    → Updated: $file"
    fi
  done < <(find . \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/.git/*" \
    \( -name "*.tsx" -o -name "*.ts" \) \
    -print0)

  if [ $count -eq 0 ]; then
    echo -e "${YELLOW}    (tidak ada file yang mengandung '${old}')${NC}"
  else
    echo -e "${GREEN}  ✓ ${label}: ${count} file diupdate${NC}"
  fi
}

# Urutan penting: replace yang lebih spesifik dulu

# href="/vendors" → href="/settings/vendors"
replace_in_files 'href="/vendors"' 'href="/settings/vendors"' "/vendors → /settings/vendors (href)"
replace_in_files "href='/vendors'" "href='/settings/vendors'" "/vendors → /settings/vendors (href single-quote)"
replace_in_files 'href="/vendors ' 'href="/settings/vendors ' "/vendors* → /settings/vendors* (href prefix)"

# router.push('/vendors') dan sejenisnya
replace_in_files "'/vendors'" "'/settings/vendors'" "/vendors → /settings/vendors (string)"
replace_in_files '"/vendors"' '"/settings/vendors"' "/vendors → /settings/vendors (string double-quote)"

# href="/projects" → href="/settings/projects"
replace_in_files 'href="/projects"' 'href="/settings/projects"' "/projects → /settings/projects (href)"
replace_in_files "href='/projects'" "href='/settings/projects'" "/projects → /settings/projects (href single-quote)"
replace_in_files "'/projects'" "'/settings/projects'" "/projects → /settings/projects (string)"
replace_in_files '"/projects"' '"/settings/projects"' "/projects → /settings/projects (string double-quote)"

# href="/categories" → href="/expenses/categories"
replace_in_files 'href="/categories"' 'href="/expenses/categories"' "/categories → /expenses/categories (href)"
replace_in_files "href='/categories'" "href='/expenses/categories'" "/categories → /expenses/categories (href single-quote)"
replace_in_files "'/categories'" "'/expenses/categories'" "/categories → /expenses/categories (string)"
replace_in_files '"/categories"' '"/expenses/categories"' "/categories → /expenses/categories (string double-quote)"

# href="/approvals" → href="/settings/approval-rules"
replace_in_files 'href="/approvals"' 'href="/settings/approval-rules"' "/approvals → /settings/approval-rules (href)"
replace_in_files "href='/approvals'" "href='/settings/approval-rules'" "/approvals → /settings/approval-rules (href single-quote)"
replace_in_files "'/approvals'" "'/settings/approval-rules'" "/approvals → /settings/approval-rules (string)"
replace_in_files '"/approvals"' '"/settings/approval-rules"' "/approvals → /settings/approval-rules (string double-quote)"

# =============================================================================
# STEP 5: HAPUS FOLDER LAMA
# =============================================================================
echo -e "${YELLOW}[5/5] Menghapus folder lama...${NC}"

for folder in "app/(dashboard)/vendors" "app/(dashboard)/projects" "app/(dashboard)/categories" "app/(dashboard)/approvals"; do
  if [ -d "$folder" ]; then
    rm -rf "$folder"
    echo -e "${GREEN}  ✓ Dihapus: $folder${NC}"
  else
    echo -e "${YELLOW}  ! Tidak ditemukan (sudah dihapus atau tidak ada): $folder${NC}"
  fi
done

# =============================================================================
# VALIDASI AKHIR
# =============================================================================
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  VALIDASI: Cek referensi path lama   ${NC}"
echo -e "${BLUE}======================================${NC}"

FOUND_OLD=0

check_old_refs() {
  local pattern="$1"
  local label="$2"
  local results
  results=$(grep -r "$pattern" . \
    --include="*.tsx" --include="*.ts" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    -l 2>/dev/null || true)

  if [ -n "$results" ]; then
    echo -e "${RED}  ✗ Masih ada referensi '$label' di:${NC}"
    echo "$results" | while read -r f; do echo "      $f"; done
    FOUND_OLD=1
  else
    echo -e "${GREEN}  ✓ Tidak ada referensi '$label'${NC}"
  fi
}

check_old_refs '"/vendors"' '"/vendors"'
check_old_refs "'/vendors'" "'/vendors'"
check_old_refs '"/projects"' '"/projects"'
check_old_refs "'/projects'" "'/projects'"
check_old_refs '"/categories"' '"/categories"'
check_old_refs "'/categories'" "'/categories'"
check_old_refs '"/approvals"' '"/approvals"'
check_old_refs "'/approvals'" "'/approvals'"

echo ""
if [ $FOUND_OLD -eq 0 ]; then
  echo -e "${GREEN}🎉 SELESAI! Semua path sudah diupdate. Tidak ada referensi lama tersisa.${NC}"
else
  echo -e "${YELLOW}⚠️  Ada beberapa referensi path lama yang perlu dicek manual (lihat di atas).${NC}"
  echo -e "${YELLOW}   Kemungkinan ada pola string yang tidak standar (template literal, dsb).${NC}"
fi

echo ""
echo -e "${BLUE}LANGKAH SELANJUTNYA:${NC}"
echo -e "  1. Update Sidebar secara manual (lihat instruksi di bawah)"
echo -e "  2. Jalankan: npm run dev  → cek tidak ada error"
echo -e "  3. Jalankan: npm run build → pastikan build sukses"
echo ""
echo -e "${YELLOW}NOTE: Script ini TIDAK mengupdate Sidebar secara otomatis${NC}"
echo -e "${YELLOW}karena struktur Sidebar tiap project berbeda-beda.${NC}"
echo -e "${YELLOW}Lihat file SIDEBAR_UPDATE_GUIDE.md untuk panduan manual.${NC}"
