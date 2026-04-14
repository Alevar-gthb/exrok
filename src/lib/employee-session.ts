export type SessionEmployee = { id: string; full_name: string | null; role: string | null }

/** Parse JSON from `get_my_employee_record()` RPC (jsonb row). */
export function parseEmployeeRecord(data: unknown): SessionEmployee | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const o = data as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  return {
    id: o.id,
    full_name: typeof o.full_name === 'string' ? o.full_name : null,
    role: typeof o.role === 'string' ? o.role : null,
  }
}
