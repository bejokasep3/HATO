import { authenticateAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { confirmSupplierRecap, getSupplierRecap } from '@/lib/services/supplier-recap'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmRecapSchema } from '../../../../../../shared/contracts/inventory'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacySupplierRecap } from '@/lib/services/legacy-readers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const id = z.uuid().parse((await params).id)
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacySupplierRecap(prisma, id), { headers: { 'Cache-Control': 'private, no-store' } })
    const data = await getSupplierRecap(prisma, id)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const id = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = confirmRecapSchema.parse(await request.json())
    const result = await confirmSupplierRecap(prisma, { actorId: auth.identity.actorId, key, id, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}
