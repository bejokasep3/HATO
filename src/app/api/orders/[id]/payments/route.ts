import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { addPayment, getOrderPayments } from '@/lib/services/payments'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createPaymentSchema } from '../../../../../../shared/contracts/payments'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacyOrderPayments } from '@/lib/services/legacy-readers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const id = z.uuid().parse((await params).id)
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyOrderPayments(prisma, id), { headers: { 'Cache-Control': 'private, no-store' } })
    return NextResponse.json(await getOrderPayments(prisma, id), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const orderId = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = createPaymentSchema.parse(await request.json())
    const result = await addPayment(prisma, { actorId: auth.identity.actorId, key, orderId, ...body, requireFull: true })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
