import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/supabase/server'

async function logoutHandler(request: NextRequest) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  // If signOut fails, we still redirect to /login.
  // Cookies should be cleared server-side by Supabase's auth client.
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[logout] signOut error:', error)
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export async function GET(request: NextRequest) {
  return logoutHandler(request)
}

export async function POST(request: NextRequest) {
  return logoutHandler(request)
}

