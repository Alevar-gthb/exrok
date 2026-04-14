type TerCategory = 'A' | 'B' | 'C'

type TerBracket = { max: number; rate: number }

const PTKP_TO_CATEGORY: Record<string, TerCategory> = {
  'TK/0': 'A',
  'TK/1': 'A',
  'K/0': 'A',
  'TK/2': 'B',
  'TK/3': 'B',
  'K/1': 'B',
  'K/2': 'B',
  'K/3': 'C',
}

const PTKP_ANNUAL_AMOUNT: Record<string, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'K/0': 58_500_000,
  'TK/2': 63_000_000,
  'K/1': 63_000_000,
  'TK/3': 67_500_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
}

function normalizePtkpStatus(ptkp: string | null | undefined): string {
  return (ptkp ?? '').trim().toUpperCase()
}

export function deriveTerCategory(ptkp: string | null | undefined): TerCategory {
  const normalized = normalizePtkpStatus(ptkp)
  return PTKP_TO_CATEGORY[normalized] ?? 'C'
}

export function shouldApplyTerMonthly({
  ptkpStatus,
  grossIncome,
}: {
  ptkpStatus: string | null | undefined
  grossIncome: number
}): boolean {
  if (!Number.isFinite(grossIncome) || grossIncome <= 0) return false
  const normalized = normalizePtkpStatus(ptkpStatus)
  const annualPtkp = PTKP_ANNUAL_AMOUNT[normalized] ?? PTKP_ANNUAL_AMOUNT['TK/0']
  const annualizedGross = grossIncome * 12
  return annualizedGross > annualPtkp
}

export function pickTerRate(brackets: TerBracket[], grossIncome: number): number {
  if (!Number.isFinite(grossIncome) || grossIncome <= 0) return 0
  const sorted = [...brackets].sort((a, b) => a.max - b.max)
  for (const b of sorted) {
    if (grossIncome <= b.max) return b.rate
  }
  return sorted.length ? sorted[sorted.length - 1].rate : 0
}

export function computePph21System({
  grossIncome,
  terRate,
  taxStatus,
}: {
  grossIncome: number
  terRate: number
  taxStatus: string | null | undefined
}): number {
  if (!Number.isFinite(grossIncome) || !Number.isFinite(terRate) || grossIncome <= 0 || terRate <= 0) return 0
  const normalized = (taxStatus ?? '').trim().toLowerCase()
  if (normalized === 'gross') {
    const denom = 1 - terRate
    if (denom <= 0) return 0
    return grossIncome * terRate / denom
  }
  return grossIncome * terRate
}
