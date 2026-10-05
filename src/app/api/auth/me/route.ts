import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'

export async function GET(request: NextRequest) {
  const result = await authenticateAdmin(request)
  if (result.error) return result.error
  const operationalSchema = await hasOperationalSchema(prisma)
  return NextResponse.json({ id: result.identity.actorId, operationalSchema }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
