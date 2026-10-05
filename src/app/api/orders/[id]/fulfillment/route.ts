import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { updateFulfillment } from '@/lib/services/order-mutations'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fulfillmentSchema } from '../../../../../../shared/contracts/orders'
import { operationalSchemaGuard } from '@/lib/services/schema-capabilities'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const id = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = fulfillmentSchema.parse(await request.json())
    const result = await updateFulfillment(prisma, { actorId: auth.identity.actorId, key, id, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
