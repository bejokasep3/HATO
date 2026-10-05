import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { confirmReceipt } from '@/lib/services/inventory'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmReceiptSchema } from '../../../../../../shared/contracts/inventory'
import { operationalSchemaGuard } from '@/lib/services/schema-capabilities'

export async function POST(request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const cycleId = z.uuid().parse((await params).cycleId)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const { expectedVersion } = confirmReceiptSchema.parse(await request.json())
    const result = await confirmReceipt(prisma, { actorId: auth.identity.actorId, key, cycleId, expectedVersion })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
