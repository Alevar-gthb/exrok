/**
 * Dry-run payroll import from CLI (no browser session).
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/dry-run-payroll-import.ts [path/to/file.xlsx] [year] [mode]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { importPayrollWorkbook } from '../src/lib/payroll-import/importer'

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const defaultPath = resolve(
    process.env.HOME ?? process.env.USERPROFILE ?? '',
    'Downloads/Exrok - Payroll 2026.xlsx'
  )
  const filePath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : defaultPath
  const year = Number(process.argv[3] ?? '2026')
  const mode = process.argv[4] === 'commit' ? 'commit' : 'dry-run'

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const buf = readFileSync(filePath)
  const supabase = createClient(url, key)

  const summary = await importPayrollWorkbook({
    supabase,
    fileBuffer: new Uint8Array(buf),
    mode,
    year,
    userId: null,
    mismatchTolerance: 500,
  })

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
