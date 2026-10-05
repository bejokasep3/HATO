import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { changeTargets } from '@/lib/services/cycles'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { changeTargetsSchema } from '../../../../../../shared/contracts/cycles'
import { operationalSchemaGuard } from '@/lib/services/schema-capabilities'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const id = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = changeTargetsSchema.parse(await request.json())
    const result = await changeTargets(prisma, { actorId: auth.identity.actorId, key, id, ...body })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) { return mutationErrorResponse(error) }
}
