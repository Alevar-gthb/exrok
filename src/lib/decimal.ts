// ============================================================
// src/lib/decimal.ts
// Helper kalkulasi keuangan menggunakan decimal.js
// Gunakan fungsi ini SELALU untuk operasi aritmatika nominal
// ============================================================
import Decimal from 'decimal.js'

// Konfigurasi presisi global
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })
const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 2,
})

/**
 * Hitung total_payment dari breakdown biaya expense.
 * Hasilnya berupa string dengan 2 desimal (e.g., "1500000.00")
 */
export function calculateTotalPayment(
  amount: string,
  vat: string,
  adminFee: string,
  serviceFee: string,
): string {
  return new Decimal(amount || '0')
    .plus(new Decimal(vat || '0'))
    .plus(new Decimal(adminFee || '0'))
    .plus(new Decimal(serviceFee || '0'))
    .toFixed(2)
}

/**
 * Format angka ke format Rupiah untuk tampilan UI.
 * e.g., "1500000.00" → "Rp 1.500.000,00"
 */
export function formatIDR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Rp 0,00'
  return IDR_FORMATTER.format(new Decimal(value.toString()).toNumber())
}

/**
 * Parse string input dari form ke format aman untuk DB.
 * Hapus karakter non-numerik kecuali titik desimal.
 */
export function parseDecimalInput(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned || isNaN(Number(cleaned))) return '0.00'
  return new Decimal(cleaned).toFixed(2)
}

/**
 * Hitung VAT 11% dari DPP (Amount)
 */
export function calculateVAT(amount: string, rate = 0.11): string {
  return new Decimal(amount || '0').times(rate).toFixed(2)
}
