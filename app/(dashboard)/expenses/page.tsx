// ============================================================
// app/(dashboard)/expenses/page.tsx
// Halaman daftar expense — Server Component
// ============================================================
import type { ComponentProps } from 'react'
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExpenseTable } from '@/components/expense-table'

export const metadata = { title: 'Expense | Exrok' }

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { status?: string; project?: string; from?: string; to?: string; cursor_created_at?: string; cursor_id?: string; limit?: string }
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pageSize = Math.min(Math.max(Number(searchParams.limit ?? 100) || 100, 20), 200)
  const cursorCreatedAt = typeof searchParams.cursor_created_at === 'string' ? searchParams.cursor_created_at : ''
  const cursorId = typeof searchParams.cursor_id === 'string' ? searchParams.cursor_id : ''

  // Build query dengan filter
  let query = supabase
    .from('expenses')
    .select(`
      id, ref_no, submission_date, transaction_date, type, description,
      amount, vat, admin_fee, service_fee, total_payment,
      status, is_reconciled, created_at, created_by,
      project:projects(id, name),
      employee:employees(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.project) query = query.eq('project_id', searchParams.project)
  if (searchParams.from) query = query.gte('transaction_date', searchParams.from)
  if (searchParams.to) query = query.lte('transaction_date', searchParams.to)
  if (cursorCreatedAt && cursorId) {
    query = query.or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`)
  }

  const { data: expensesRaw } = await query
  const hasMore = (expensesRaw?.length ?? 0) > pageSize
  const expenses = hasMore ? (expensesRaw ?? []).slice(0, pageSize) : (expensesRaw ?? [])
  const last = expenses.length > 0 ? expenses[expenses.length - 1] as { created_at: string; id: string } : null
  const nextParams = new URLSearchParams()
  if (searchParams.status) nextParams.set('status', searchParams.status)
  if (searchParams.project) nextParams.set('project', searchParams.project)
  if (searchParams.from) nextParams.set('from', searchParams.from)
  if (searchParams.to) nextParams.set('to', searchParams.to)
  nextParams.set('limit', String(pageSize))
  if (hasMore && last) {
    nextParams.set('cursor_created_at', last.created_at)
    nextParams.set('cursor_id', last.id)
  }
  const loadMoreHref = hasMore && last ? `/expenses?${nextParams.toString()}` : null

  // Fetch projects untuk filter dropdown
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('status', 'Active')
    .order('name')

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Expense</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            {expenses?.length ?? 0} transaksi ditemukan
          </p>
        </div>
        <Link
          href="/expenses/new"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', background: '#0F172A', color: '#fff',
            borderRadius: '8px', fontSize: '13px', fontWeight: '500',
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Ajukan Expense
        </Link>
      </div>

      <ExpenseTable
        expenses={(expenses ?? []) as unknown as ComponentProps<typeof ExpenseTable>['expenses']}
        projects={projects ?? []}
        userId={user.id}
        loadMoreHref={loadMoreHref}
      />
    </div>
  )
}
