import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export type AdminIdentity = { actorId: string }
type AdminResult = { identity: AdminIdentity; error?: never } | { identity?: never; error: NextResponse }

function deny(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message }, requestId: crypto.randomUUID() }, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function authenticateAdmin(request: NextRequest): Promise<AdminResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const adminId = process.env.HATO_ADMIN_USER_ID
  if (!url || !key || !adminId) {
    return { error: deny(503, 'AUTH_NOT_CONFIGURED', 'Akses manajer belum dikonfigurasi') }
  }

  const authorization = request.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
  if (authorization && !bearer) return { error: deny(401, 'INVALID_AUTH', 'Sesi tidak valid') }
  if (!bearer && request.cookies.getAll().length === 0) {
    return { error: deny(401, 'UNAUTHENTICATED', 'Silakan masuk kembali') }
  }

  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL
    const origin = request.headers.get('origin')
    let expectedOrigin: string | null = null
    try { expectedOrigin = allowedOrigin ? new URL(allowedOrigin).origin : null } catch { expectedOrigin = null }
    if (!expectedOrigin || !origin || origin !== expectedOrigin) {
      return { error: deny(403, 'INVALID_ORIGIN', 'Asal permintaan tidak diizinkan') }
    }
  }

  try {
    const client = bearer
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : createServerClient(url, key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value)
          },
        },
      })
    const { data, error } = await client.auth.getUser(bearer || undefined)
    if (error || !data.user) return { error: deny(401, 'UNAUTHENTICATED', 'Silakan masuk kembali') }
    if (data.user.id !== adminId) return { error: deny(403, 'NOT_ADMIN', 'Akun ini tidak memiliki akses manajer') }
    return { identity: { actorId: data.user.id } }
  } catch {
    return { error: deny(503, 'AUTH_UNAVAILABLE', 'Verifikasi login sementara tidak tersedia') }
  }
}

export function withAdmin<Args extends unknown[]>(
  handler: (request: NextRequest, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: Args): Promise<NextResponse> => {
    const result = await authenticateAdmin(request)
    if (result.error) return result.error
    const response = await handler(request, ...args)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
}
