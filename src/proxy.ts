import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/cron/') || request.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.next({ request })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next({ request })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value)
        response = NextResponse.next({ request })
        for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options)
        response.headers.set('Cache-Control', 'private, no-store')
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims && !request.nextUrl.pathname.startsWith('/api/')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie.name, cookie.value)
    redirect.headers.set('Cache-Control', 'private, no-store')
    return redirect
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
