// app/(dashboard)/dashboard/page.tsx
// Inbox approval hanya untuk baris yang approver-nya = karyawan login (bukan semua pending org).
import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ApprovalsInboxClient, type ApprovalInboxRow } from '@/components/approvals-inbox-client'

export const metadata = { title: 'Dashboard | Exrok' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('id, full_name, role')
    .eq('email', user.email ?? '')
    .single()

  if (!me) redirect('/login')

  const { data: approvalRows } = await supabase
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

  const rows = (approvalRows ?? []).filter(r => {
    const e = r.expense
    return e != null && !Array.isArray(e)
  }) as unknown as ApprovalInboxRow[]

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: rows.length > 0 ? '28px' : '0' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Halo{me.full_name ? `, ${me.full_name}` : ''}. Ringkasan aktivitas Anda.
        </p>
      </div>

      {rows.length > 0 ? (
        <ApprovalsInboxClient rows={rows} variant="embedded" />
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
