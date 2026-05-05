// app/(dashboard)/dashboard/page.tsx
// Inbox approval hanya untuk baris yang approver-nya = karyawan login (bukan semua pending org).
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ApprovalsInboxClient, type ApprovalInboxRow } from '@/components/approvals-inbox-client'
import { parseEmployeeRecord } from '@/lib/employee-session'

export const metadata = { title: 'Dashboard | Exrok' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { cursor_created_at?: string; cursor_id?: string; limit?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empJson } = await supabase.rpc('get_my_employee_record')
  const me = parseEmployeeRecord(empJson)

  if (!me) redirect('/login')

  const pageSize = Math.min(Math.max(Number(searchParams.limit ?? 100) || 100, 20), 200)
  const cursorCreatedAt = typeof searchParams.cursor_created_at === 'string' ? searchParams.cursor_created_at : ''
  const cursorId = typeof searchParams.cursor_id === 'string' ? searchParams.cursor_id : ''

  let approvalsQuery = supabase
    .from('expense_approvals')
    .select(`
      id,
      status,
      created_at,
      approval_rule:approval_rules(id, name),
      expense:expenses(
        id,
        ref_no,
        description,
        type,
        amount,
        total_payment,
        business_unit,
        department,
        transaction_date,
        created_at,
        employee:employees(id, full_name)
      )
    `)
    .eq('status', 'Pending')
    .eq('approver_employee_id', me.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)
  if (cursorCreatedAt && cursorId) {
    approvalsQuery = approvalsQuery.or(`created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`)
  }
  const { data: approvalRows } = await approvalsQuery

  const hasMore = (approvalRows?.length ?? 0) > pageSize
  const windowed = hasMore ? (approvalRows ?? []).slice(0, pageSize) : (approvalRows ?? [])
  const rows = windowed.filter(r => {
    const e = r.expense
    return e != null && !Array.isArray(e)
  }) as unknown as ApprovalInboxRow[]
  const last = rows.length > 0 ? (rows[rows.length - 1] as { created_at: string; id: string }) : null
  const nextParams = new URLSearchParams()
  nextParams.set('limit', String(pageSize))
  if (hasMore && last) {
    nextParams.set('cursor_created_at', last.created_at)
    nextParams.set('cursor_id', last.id)
  }
  const loadMoreHref = hasMore && last ? `/dashboard?${nextParams.toString()}` : null

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: rows.length > 0 ? '28px' : '0' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Halo{me.full_name ? `, ${me.full_name}` : ''}. Ringkasan aktivitas Anda.
        </p>
      </div>

      {rows.length > 0 ? (
        <ApprovalsInboxClient rows={rows} variant="embedded" myEmployeeId={me.id} loadMoreHref={loadMoreHref} />
      ) : (
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '28px 24px',
            maxWidth: '520px',
          }}
        >
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 16px' }}>
            Tidak ada expense yang menunggu persetujuan Anda. Inbox approval hanya muncul jika Anda ditunjuk sebagai approver pada approval rule.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <Link
              href="/expenses/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#0F172A',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                textDecoration: 'none',
              }}
            >
              Ajukan expense
            </Link>
            <Link
              href="/expenses"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                border: '1px solid #E2E8F0',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                textDecoration: 'none',
                background: '#fff',
              }}
            >
              Lihat daftar expense
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
