import type { SupabaseClient } from '@supabase/supabase-js'
import { netFromCompensationRows, pickDefaultProjectId } from '@/lib/payroll-helpers'
import type { PayrollLineAdjustment } from '@/types/database.types'

/**
 * Membuat payroll_runs + payroll_run_lines untuk periode (idempoten: gagal jika periode sudah ada).
 * Dipakai oleh server action (user session) dan cron (service role).
 */
export async function insertPayrollRunForPeriod(
  supabase: SupabaseClient,
  periodYear: number,
  periodMonth: number,
  createdBy: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('payroll_runs')
    .select('id')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .maybeSingle()

  if (existing) {
    return { ok: false, error: 'Payroll untuk periode ini sudah ada.' }
  }

  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .insert({
      period_year: periodYear,
      period_month: periodMonth,
      status: 'draft',
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (runErr || !run) {
    return { ok: false, error: runErr?.message ?? 'Gagal membuat payroll run.' }
  }

  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, status')
    .eq('status', 'Active')
    .order('full_name')

  if (empErr || !employees?.length) {
    await supabase.from('payroll_runs').delete().eq('id', run.id)
    return { ok: false, error: empErr?.message ?? 'Tidak ada karyawan aktif.' }
  }

  const ids = employees.map(e => e.id)
  type CompRow = {
    employee_id: string
    kind: 'earning' | 'deduction'
    amount: string | number
    include_in_monthly_payroll?: boolean
  }
  const { data: compRows } = await supabase
    .from('employee_salary_component_amounts')
    .select('employee_id, amount, salary_component_templates(kind, include_in_monthly_payroll)')
    .in('employee_id', ids)

  const comps: CompRow[] = (compRows ?? []).map((r: Record<string, unknown>) => {
    const t = r.salary_component_templates as
      | { kind?: string; include_in_monthly_payroll?: boolean }
      | { kind?: string; include_in_monthly_payroll?: boolean }[]
      | null
    const tmpl = Array.isArray(t) ? t[0] : t
    const kind = tmpl?.kind ?? 'earning'
    return {
      employee_id: r.employee_id as string,
      kind: kind as 'earning' | 'deduction',
      amount: r.amount as string | number,
      include_in_monthly_payroll: tmpl?.include_in_monthly_payroll !== false ? undefined : false,
    }
  })

  const { data: assigns } = await supabase
    .from('employee_project_assignments')
    .select('employee_id, project_id, is_primary, ended_on')
    .in('employee_id', ids)

  type AssignRow = { employee_id: string; project_id: string; is_primary: boolean; ended_on: string | null }
  const compByEmp = new Map<string, CompRow[]>()
  for (const c of (comps ?? []) as CompRow[]) {
    const list = compByEmp.get(c.employee_id) ?? []
    list.push(c)
    compByEmp.set(c.employee_id, list)
  }
  const assignByEmp = new Map<string, AssignRow[]>()
  for (const a of (assigns ?? []) as AssignRow[]) {
    const list = assignByEmp.get(a.employee_id) ?? []
    list.push(a)
    assignByEmp.set(a.employee_id, list)
  }

  const lines = employees.map(emp => {
    const crows = compByEmp.get(emp.id) ?? []
    const forNet = crows.map(c => ({
      kind: c.kind,
      amount: String(c.amount),
      include_in_monthly_payroll: c.include_in_monthly_payroll,
    }))
    const base = netFromCompensationRows(forNet)
    const projectId = pickDefaultProjectId(assignByEmp.get(emp.id) ?? [])
    return {
      run_id: run.id,
      employee_id: emp.id,
      project_id: projectId,
      base_amount: base.toFixed(2),
      amount: base.toFixed(2),
      adjustments: [] as PayrollLineAdjustment[],
      components_snapshot: { components: crows },
    }
  })

  const { error: lineErr } = await supabase.from('payroll_run_lines').insert(lines)

  if (lineErr) {
    await supabase.from('payroll_runs').delete().eq('id', run.id)
    return { ok: false, error: lineErr.message }
  }

  return { ok: true, id: run.id }
}
