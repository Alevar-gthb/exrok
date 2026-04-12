import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/supabase/server'

async function logoutHandler(request: NextRequest) {
  const supabase = await createClient()

  // #region agent log
  fetch('http://127.0.0.1:7492/ingest/95e55aea-9b28-4283-be44-7fdce733f9ed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8d548a',
    },
    body: JSON.stringify({
      sessionId: '8d548a',
      runId: 'preflight',
      hypothesisId: 'H3_logoutClickHandlerNotFiringOrNavBlocked',
      location: 'app/api/logout/route.ts:logoutHandler',
      message: 'logout route handler hit',
      data: { method: request.method, path: request.nextUrl?.pathname },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

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

