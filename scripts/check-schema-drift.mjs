import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const outFile = resolve(process.cwd(), '.tmp-schema-diff.sql')
const cmd = spawnSync(
  'npx',
  ['supabase', 'db', 'diff', '--local', '--schema', 'public', '--file', outFile],
  { stdio: 'inherit' }
)

if (cmd.status !== 0) {
  process.exit(cmd.status ?? 1)
}

if (!existsSync(outFile)) {
  console.error('supabase db diff did not produce output file.')
  process.exit(1)
}

const sql = readFileSync(outFile, 'utf8')
unlinkSync(outFile)

const meaningful = sql
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith('--'))

if (meaningful.length > 0) {
  console.error('Schema drift detected. Generate/apply migration before committing.')
  process.exit(1)
}

console.log('No schema drift detected.')
