import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchMySessionEmployee } from '@/lib/employee-session'
import { validatePasswordStrength } from '@/lib/password-policy'

type CreateUserBody = {
  full_name?: string
  email?: string
  role?: string
  status?: string
  password?: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const me = await fetchMySessionEmployee(supabase)
  if (!me || me.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateUserBody
  try {
    body = (await req.json()) as CreateUserBody
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  }

  const fullName = (body.full_name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const role = (body.role ?? 'staff').trim()
  const status = (body.status ?? 'Active').trim()
  const password = body.password ?? ''

  if (!fullName || !email) {
    return NextResponse.json({ error: 'Nama lengkap dan email wajib diisi.' }, { status: 400 })
  }
  if (!['owner', 'finance', 'ga', 'staff'].includes(role)) {
    return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 })
  }
  if (!['Active', 'Inactive'].includes(status)) {
    return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 })
  }
  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const admin = createAdminClient()
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { error: created.error?.message ?? 'Gagal membuat akun auth user.' },
      { status: 400 }
    )
  }

  const insertEmployee = await supabase.from('employees').insert({
    full_name: fullName,
    email,
    role,
    status,
    salary_amount: 0,
    nip: null,
    job_title: null,
    is_permanent: false,
    auth_user_id: created.data.user.id,
  })

  if (insertEmployee.error) {
    await admin.auth.admin.deleteUser(created.data.user.id)
    return NextResponse.json(
      { error: insertEmployee.error.message ?? 'Gagal menyimpan data employee.' },
      { status: 400 }
    )
  }

  console.info('[audit] create_user_with_password', {
    actor_user_id: user.id,
    target_auth_user_id: created.data.user.id,
    email,
    role,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
