import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredExpenseFields = [
  'category_id',
  'subcategory_id',
  'vendor_id',
  'business_unit',
  'department',
  'payment_method',
  'due_date',
]

const repoRoot = resolve(process.cwd())
const typesFile = readFileSync(resolve(repoRoot, 'src/types/database.types.ts'), 'utf8')
const zodFile = readFileSync(resolve(repoRoot, 'src/lib/validations/expense.schema.ts'), 'utf8')

function assertContainsAll(source, fields, sourceName) {
  const missing = fields.filter((f) => !source.includes(`${f}:`))
  if (missing.length > 0) {
    throw new Error(`${sourceName} missing required fields: ${missing.join(', ')}`)
  }
}

assertContainsAll(typesFile, requiredExpenseFields, 'Expense interface')
assertContainsAll(zodFile, requiredExpenseFields, 'expenseSchema')

console.log('Zod/schema sync check passed for critical expense fields.')
