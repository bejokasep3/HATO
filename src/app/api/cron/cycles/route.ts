import { NextRequest, NextResponse } from 'next/server'

function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_NOT_CONFIGURED' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  return authorizeCron(request) ?? NextResponse.json({ status: 'disabled', message: 'Transisi siklus otomatis belum diaktifkan.' })
}

export async function POST(request: NextRequest) {
  return authorizeCron(request) ?? NextResponse.json({ status: 'disabled', message: 'Transisi siklus otomatis belum diaktifkan.' })
}
