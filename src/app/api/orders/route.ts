import { authenticateAdmin, withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { createOrder } from '@/lib/services/orders'
import { editOrder } from '@/lib/services/order-mutations'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { paymentSummary } from '@/lib/domain/payments'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { createOrderV2Schema, editOrderV2Schema } from '../../../../shared/contracts/orders'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacyOrders } from '@/lib/services/legacy-readers'

async function GETImpl(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const where: Prisma.OrderWhereInput = {}
    const cycleId = searchParams.get('cycleId')
    const memberId = searchParams.get('memberId')
    const requestedPaymentStatus = searchParams.get('paymentStatus')
    const orderStatus = searchParams.get('orderStatus')
    if (!await hasOperationalSchema(prisma)) {
      return NextResponse.json(await getLegacyOrders(prisma, { cycleId, memberId, orderStatus, paymentStatus: requestedPaymentStatus }), { headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (cycleId) where.cycleId = cycleId
    if (memberId) where.memberId = memberId
    if (orderStatus) where.orderStatus = orderStatus

    const orders = await prisma.order.findMany({
      where,
      include: {
        cycle: { select: { id: true, label: true, status: true, periodState: true, rulesVersion: true } },
        member: { include: { group: true } },
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    const formatted = orders.map((order) => {
      const summary = paymentSummary(
        order.totalAmount.toFixed(2),
        order.payments.map((payment) => ({ amount: payment.amount.toFixed(2), reversed: Boolean(payment.reversedAt) })),
        Boolean(order.ledgerReconciledAt),
      )
      return {
        ...order,
        pricingPending: order.cycle.rulesVersion === 2 && order.cycle.periodState === 'draft',
        totalAmount: order.totalAmount.toFixed(2),
        paymentStatus: summary.status,
        paymentSummary: summary,
        items: order.items.map((item) => ({
          ...item,
          quantity: item.quantity.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })),
        payments: order.payments.map((payment) => ({
          ...payment,
          amount: payment.amount.toFixed(2),
        })),
      }
    })
    const filtered = requestedPaymentStatus
      ? formatted.filter((order) => order.paymentSummary.status === requestedPaymentStatus)
      : formatted
    return NextResponse.json(filtered, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = createOrderV2Schema.parse(await request.json())
    const result = await createOrder(prisma, { actorId: auth.identity.actorId, key, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const raw = await request.json()
    if (!raw || typeof raw !== 'object' || 'paymentStatus' in raw || 'orderStatus' in raw || !('expectedVersion' in raw)) {
      return rejectLegacyMutation()
    }
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = editOrderV2Schema.parse(raw)
    const result = await editOrder(prisma, { actorId: auth.identity.actorId, key, ...body })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return mutationErrorResponse(error) }
}

async function rejectLegacyMutation() {
  return NextResponse.json({ error: { code: 'CLIENT_UPDATE_REQUIRED', message: 'Gunakan aksi pesanan dan pembayaran versi terbaru' }, requestId: crypto.randomUUID() }, { status: 409 })
}

export const GET = withAdmin(GETImpl)
export const DELETE = withAdmin(rejectLegacyMutation)
