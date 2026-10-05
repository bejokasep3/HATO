import { authenticateAdmin, withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { getCycleAvailability } from '@/lib/services/availability'
import { saveReceiptDraft } from '@/lib/services/inventory'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { saveReceiptDraftSchema } from '../../../../shared/contracts/inventory'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacyInventory } from '@/lib/services/legacy-readers'

async function GETImpl(request: NextRequest) {
  try {
    const cycleId = new URL(request.url).searchParams.get('cycleId')
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyInventory(prisma, cycleId))
    if (!cycleId) {
      const cycles = await prisma.cycle.findMany({
        orderBy: { periodStart: 'desc' },
        include: { goodsReceipt: { select: { status: true } }, _count: { select: { orders: true } } },
      })
      return NextResponse.json(cycles.map((cycle) => ({
        cycleId: cycle.id, cycleLabel: cycle.label, periodStart: cycle.periodStart,
        periodState: cycle.periodState, receiptStatus: cycle.goodsReceipt?.status ?? 'none',
        totalOrders: cycle._count.orders,
      })))
    }
    const id = z.uuid().parse(cycleId)
    const [availability, receipt] = await Promise.all([
      getCycleAvailability(prisma, id),
      prisma.goodsReceipt.findUnique({
        where: { cycleId: id },
        include: { items: { orderBy: { productId: 'asc' } } },
      }),
    ])
    return NextResponse.json({
      ...availability,
      receipt: receipt ? {
        id: receipt.id,
        status: receipt.status,
        receivedAt: receipt.receivedAt,
        supplierNote: receipt.supplierNote,
        version: receipt.version,
        confirmedAt: receipt.confirmedAt,
        items: receipt.items.map((item) => ({
          productId: item.productId,
          orderedQty: item.orderedQty.toFixed(2),
          receivedQty: item.receivedQty.toFixed(2),
          damagedQty: item.damagedQty.toFixed(2),
          purchasePrice: item.purchasePrice.toFixed(2),
          notes: item.notes,
        })),
      } : null,
    })
  } catch (error) { return mutationErrorResponse(error) }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = saveReceiptDraftSchema.parse(await request.json())
    const result = await saveReceiptDraft(prisma, { actorId: auth.identity.actorId, key, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}

async function rejectLegacyMutation() {
  return NextResponse.json({ error: { code: 'CLIENT_UPDATE_REQUIRED', message: 'Gunakan draf dan konfirmasi penerimaan versi terbaru' }, requestId: crypto.randomUUID() }, { status: 409 })
}

export const GET = withAdmin(GETImpl)
export const PATCH = withAdmin(rejectLegacyMutation)
