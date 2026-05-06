import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { validatePasswordStrength } from '@/lib/password-policy'

type ResetBody = {
  newPassword?: string
}

type RouteContext = {
  params: { id: string }
}

/** Mirror DB matching: lower(btrim(email)) via JS trim + lowerCase. */
function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

const LIST_USERS_PER_PAGE = 200
/** Guard against malformed API pagination loops (200k users at 200/page). */
const LIST_USERS_MAX_PAGES = 1000

async function findAuthUserIdByNormalizedEmail(
  admin: ReturnType<typeof createAdminClient>,
  emailNorm: string
): Promise<{ id: string } | null> {
  let page = 1
  while (page <= LIST_USERS_MAX_PAGES) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    })
    if (error) {
      throw new Error(error.message)
    }
    const users = data.users
    const matched = users.find(u => normalizeAuthEmail(u.email) === emailNorm)
    if (matched) return { id: matched.id }
    if (users.length < LIST_USERS_PER_PAGE) break
    page += 1
  }
  return null
}

export async function POST(req: Request, ctx: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await fetchMySessionEmployee(supabase)
  if (!me || me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: ResetBody
  try {
    body = (await req.json()) as ResetBody
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  }

  const newPassword = body.newPassword ?? ''
  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const employeeId = ctx.params.id
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, email, auth_user_id')
    .eq('id', employeeId)
    .single()

  if (employeeError || !employee) {
    return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
  }

  const admin = createAdminClient()
  let authUserId = employee.auth_user_id as string | null

  if (!authUserId) {
    const emailNorm = normalizeAuthEmail(employee.email as string | null)
    if (!emailNorm) {
      return NextResponse.json(
        { error: 'User belum punya email/auth account untuk di-reset.' },
        { status: 400 }
      )
    }
    let matched: { id: string } | null
    try {
      matched = await findAuthUserIdByNormalizedEmail(admin, emailNorm)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal mencari akun auth.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (!matched) {
      return NextResponse.json({ error: 'Akun auth user tidak ditemukan.' }, { status: 404 })
    }
    authUserId = matched.id
    const { error: linkErr } = await supabase
      .from('employees')
      .update({ auth_user_id: authUserId })
      .eq('id', employee.id)
    if (linkErr) {
      console.warn('[reset-password] gagal menyimpan auth_user_id ke employees', {
        employee_id: employee.id,
        message: linkErr.message,
      })
    }
  }

  const updated = await admin.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  })
  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 400 })
  }

  console.info('[audit] owner_reset_user_password', {
    actor_user_id: user.id,
    employee_id: employee.id,
    auth_user_id: authUserId,
  })

  return NextResponse.json({ ok: true })
}
