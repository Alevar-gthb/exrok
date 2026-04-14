// app/page.tsx — Root redirect berdasarkan session auth
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')
  redirect('/login')
}
