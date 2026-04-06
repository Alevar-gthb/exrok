// app/api/reports/export/route.ts
// GET /api/reports/export?from=2025-01-01&to=2025-12-31&project_id=xxx
import { createClient } from '@/supabase/server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const projectId = searchParams.get('project_id')

  // Query expenses
  let query = supabase
    .from('expenses')
    .select(`
      ref_no, transaction_date, type, description,
      amount, vat, admin_fee, service_fee, total_payment,
      status, payment_method, business_unit, department,
      due_date, payment_date, is_reconciled,
      project:projects(name),
      employee:employees(full_name),
      category:expense_categories(name),
      subcategory:expense_subcategories(name),
      vendor:vendors(name)
    `)
    .order('transaction_date', { ascending: false })

  if (from) query = query.gte('transaction_date', from)
  if (to) query = query.lte('transaction_date', to)
  if (projectId) query = query.eq('project_id', projectId)

  const { data: expenses, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build Excel
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Exrok'; wb.created = new Date()
  const ws = wb.addWorksheet('Expense Report')

  // Header style
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

  ws.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Tanggal', key: 'transaction_date', width: 14 },
    { header: 'Ref No', key: 'ref_no', width: 20 },
    { header: 'Business Unit', key: 'business_unit', width: 14 },
    { header: 'Kategori', key: 'category', width: 22 },
    { header: 'Subkategori', key: 'subcategory', width: 22 },
    { header: 'Deskripsi', key: 'description', width: 30 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Karyawan', key: 'employee', width: 20 },
    { header: 'Proyek', key: 'project', width: 18 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Metode Bayar', key: 'payment_method', width: 18 },
    { header: 'Amount (DPP)', key: 'amount', width: 16 },
    { header: 'VAT', key: 'vat', width: 14 },
    { header: 'Admin Fee', key: 'admin_fee', width: 14 },
    { header: 'Service Fee', key: 'service_fee', width: 14 },
    { header: 'Total Payment', key: 'total_payment', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Due Date', key: 'due_date', width: 14 },
    { header: 'Payment Date', key: 'payment_date', width: 14 },
    { header: 'Rekonsiliasi', key: 'is_reconciled', width: 13 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.fill = headerFill; cell.font = headerFont
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }
  })
  headerRow.height = 22

  // Data rows
  const idrFmt = '#,##0'
  expenses?.forEach((exp, idx) => {
    const row = ws.addRow({
      no: idx + 1,
      transaction_date: exp.transaction_date,
      ref_no: exp.ref_no ?? '',
      business_unit: exp.business_unit ?? '',
      category: (exp.category as any)?.name ?? '',
      subcategory: (exp.subcategory as any)?.name ?? '',
      description: exp.description ?? '',
      vendor: (exp.vendor as any)?.name ?? '',
      employee: (exp.employee as any)?.full_name ?? '',
      project: (exp.project as any)?.name ?? '',
      department: exp.department ?? '',
      payment_method: exp.payment_method ?? '',
      amount: parseFloat(exp.amount) || 0,
      vat: parseFloat(exp.vat) || 0,
      admin_fee: parseFloat(exp.admin_fee) || 0,
      service_fee: parseFloat(exp.service_fee) || 0,
      total_payment: parseFloat(exp.total_payment) || 0,
      status: exp.status,
      due_date: exp.due_date ?? '',
      payment_date: (exp as any).payment_date ?? '',
      is_reconciled: exp.is_reconciled ? 'Ya' : 'Tidak',
    })

    // Format currency columns
    ;['amount', 'vat', 'admin_fee', 'service_fee', 'total_payment'].forEach(k => {
      const cell = row.getCell(k); cell.numFmt = idrFmt
    })

    // Alternate row color
    if (idx % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      })
    }

    row.height = 18
  })

  // Summary row
  const lastRow = (expenses?.length ?? 0) + 2
  ws.getCell(`L${lastRow}`).value = 'TOTAL'
  ws.getCell(`L${lastRow}`).font = { bold: true }
  const totalCols = ['M', 'N', 'O', 'P', 'Q']
  const colKeys = ['amount', 'vat', 'admin_fee', 'service_fee', 'total_payment']
  totalCols.forEach((col, i) => {
    ws.getCell(`${col}${lastRow}`).value = { formula: `SUM(${col}2:${col}${lastRow - 1})` }
    ws.getCell(`${col}${lastRow}`).numFmt = idrFmt
    ws.getCell(`${col}${lastRow}`).font = { bold: true }
    ws.getCell(`${col}${lastRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
  })

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `exrok-expense-report-${dateStr}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
