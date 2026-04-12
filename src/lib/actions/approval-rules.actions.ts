'use server'

import { createClient } from '@/supabase/server'
import type { ActionResult } from '@/lib/actions/expense.actions'
import type { ApprovalRuleInsert, ApprovalRuleUpdate } from '@/types/database.types'

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const { data: emp } = await supabase.from('employees').select('role').eq('email', user.email ?? '').single()
  if (emp?.role !== 'owner') return { ok: false, error: 'Hanya owner yang dapat mengelola approval rules' }
  return { ok: true }
}

export async function createApprovalRule(payload: Omit<ApprovalRuleInsert, 'created_by'>): Promise<ActionResult<{ id: string }>> {
  const gate = await requireOwner()
  if (!gate.ok) return { success: false, error: gate.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('approval_rules')
    .insert({
      ...payload,
      min_amount: String(payload.min_amount),
      max_amount: payload.max_amount != null ? String(payload.max_amount) : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}

export async function updateApprovalRule(id: string, payload: ApprovalRuleUpdate): Promise<ActionResult> {
  const gate = await requireOwner()
  if (!gate.ok) return { success: false, error: gate.error }

  const supabase = await createClient()
  const patch = { ...payload }
  if (patch.min_amount !== undefined) patch.min_amount = String(patch.min_amount) as unknown as ApprovalRuleUpdate['min_amount']
  if (patch.max_amount !== undefined && patch.max_amount !== null) patch.max_amount = String(patch.max_amount) as unknown as ApprovalRuleUpdate['max_amount']

  const { error } = await supabase.from('approval_rules').update(patch).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteApprovalRule(id: string): Promise<ActionResult> {
  const gate = await requireOwner()
  if (!gate.ok) return { success: false, error: gate.error }

  const supabase = await createClient()
  const { error } = await supabase.from('approval_rules').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
