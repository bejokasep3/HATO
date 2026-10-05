import { authenticateAdmin, withAdmin } from '@/lib/auth/admin'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCycleSchema } from '../../../../shared/contracts/cycles'
import { createCycle } from '@/lib/services/cycles'
import { mutationErrorResponse, requireIdempotencyKey } from '@/lib/services/mutation'
import { paymentSummary } from '@/lib/domain/payments'
import { sumMoney } from '@/lib/domain/money'
import { hasOperationalSchema, operationalSchemaGuard } from '@/lib/services/schema-capabilities'
import { getLegacyCycles } from '@/lib/services/legacy-readers'

async function GETImpl() {
  try {
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyCycles(prisma))
    const cycles = await prisma.cycle.findMany({
      include: {
        _count: {
          select: {
            rotationSchedules: true,
          },
        },
        orders: {
          where: { cancelledAt: null },
          select: {
            totalAmount: true,
            ledgerReconciledAt: true,
            payments: { select: { amount: true, reversedAt: true } },
          },
        },
        targets: true,
      },
      orderBy: { periodStart: 'desc' },
    })

    const formatted = cycles.map((c) => {
      const orderValue = sumMoney(c.orders.map((order) => order.totalAmount.toFixed(2)))
      const summaries = c.orders.map((order) => paymentSummary(
        order.totalAmount.toFixed(2),
        order.payments.map((payment) => ({ amount: payment.amount.toFixed(2), reversed: Boolean(payment.reversedAt) })),
        Boolean(order.ledgerReconciledAt),
      ))
      const verified = summaries.filter((summary) => summary.status !== 'unverified')
      const receivedPayments = sumMoney(verified.map((summary) => summary.paidAmount!))
      const knownOutstanding = sumMoney(verified.map((summary) => summary.outstandingAmount!))

      return {
        id: c.id,
        label: c.label,
        periodStart: c.periodStart,
        orderDeadline: c.orderDeadline,
        deliveryDate: c.deliveryDate,
        status: c.status,
        notes: c.notes,
        totalOrders: c.orders.length,
        totalRotation: c._count.rotationSchedules,
        totalAmount: Number(orderValue),
        paidAmount: Number(receivedPayments),
        orderValue,
        receivedPayments,
        knownOutstanding,
        unknownBalanceCount: summaries.length - verified.length,
        periodEnd: c.periodEnd,
        supplierDeadline: c.supplierDeadline,
        periodState: c.periodState,
        version: c.version,
        targets: c.targets.map((target) => ({ groupCode: target.groupCode, quantity: target.quantity.toFixed(2), unit: target.unit })),
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching cycles:', error)
    return NextResponse.json({ error: 'Failed to fetch cycles' }, { status: 500 })
  }
}

async function POSTImpl(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request)
    if (auth.error) return auth.error
    const schemaError = await operationalSchemaGuard(prisma)
    if (schemaError) return schemaError
    const key = requireIdempotencyKey(request.headers.get('Idempotency-Key'))
    const body = createCycleSchema.parse(await request.json())
    const result = await createCycle(prisma, { actorId: auth.identity.actorId, key, ...body })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return mutationErrorResponse(error)
  }
}

export const GET = withAdmin(GETImpl)
export const POST = POSTImpl
