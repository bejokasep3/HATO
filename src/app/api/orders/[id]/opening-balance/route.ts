import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { confirmOpeningBalance } from '@/lib/services/payments'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { confirmOpeningBalanceSchema } from '../../../../../../shared/contracts/payments'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const orderId = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = confirmOpeningBalanceSchema.parse(await request.json())
    const result = await confirmOpeningBalance(prisma, { actorId: auth.identity.actorId, key, orderId, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
