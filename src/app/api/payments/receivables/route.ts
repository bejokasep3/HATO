import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getReceivables } from '@/lib/services/payments'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyReceivables } from '@/lib/services/legacy-readers'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const params = new URL(request.url).searchParams
    const page = z.coerce.number().int().min(1).parse(params.get('page') ?? '1')
    const pageSize = z.coerce.number().int().min(1).max(100).parse(params.get('pageSize') ?? '30')
    const cycleId = params.get('cycleId') ? z.uuid().parse(params.get('cycleId')) : null
    const groupId = params.get('groupId') ? z.uuid().parse(params.get('groupId')) : null
    if (!await hasOperationalSchema(prisma)) {
      return NextResponse.json(await getLegacyReceivables(prisma, { page, pageSize, cycleId, groupId }), { headers: { 'Cache-Control': 'private, no-store' } })
    }
    return NextResponse.json(await getReceivables(prisma, { page, pageSize, cycleId, groupId }), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
