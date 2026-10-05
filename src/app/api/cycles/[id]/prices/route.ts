import { authenticateAdmin, withAdmin } from '@/lib/auth/admin'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setCyclePrices } from '@/lib/services/cycles'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { z } from 'zod'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacyPrices } from '@/lib/services/legacy-readers'

const priceUpdateSchema = z.object({
  expectedVersion: z.int().nonnegative(),
  items: z.array(z.object({
    productId: z.uuid(),
    consumerPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0),
    traderPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0),
  })).min(1),
})

async function GETImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyPrices(prisma, id))
    const prices = await prisma.weeklyPrice.findMany({
      where: { cycleId: id },
      include: { product: true },
      orderBy: { product: { sortOrder: 'asc' } },
    })

    const formatted = prices.map((wp) => {
      const consumer = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
      const trader = wp.traderPrice !== null ? Number(wp.traderPrice) : consumer
      return {
        ...wp,
        price: Number(wp.price),
        consumerPrice: consumer,
        traderPrice: trader,
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching prices:', error)
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}

async function PUTImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const id = z.uuid().parse((await params).id)
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = priceUpdateSchema.parse(await request.json())
    const result = await setCyclePrices(prisma, { actorId: auth.identity.actorId, key, id, ...body })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return mutationErrorResponse(error)
  }
}

export const GET = withAdmin(GETImpl)
export const PUT = PUTImpl
