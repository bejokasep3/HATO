import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { openCycle } from '@/lib/services/cycles'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { operationalSchemaGuard } from '@/lib/services/schema-capabilities'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const id = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const { expectedVersion } = z.object({ expectedVersion: z.int().nonnegative() }).parse(await request.json())
    const result = await openCycle(prisma, { actorId: auth.identity.actorId, key, id, expectedVersion })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) { return mutationErrorResponse(error) }
}
