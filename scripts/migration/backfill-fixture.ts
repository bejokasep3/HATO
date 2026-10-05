import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from './test-db'

const prisma = new PrismaClient()
const fixtureOrderId = '00000000-0000-4000-8000-000000000006'

async function main() {
  await assertIsolatedTestDatabase(prisma)

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${fixtureOrderId}::uuid FOR UPDATE`
    const order = await tx.order.findUniqueOrThrow({ where: { id: fixtureOrderId } })
    if (order.totalAmount.toFixed(2) !== '100000.00' || order.paymentStatus !== 'paid') {
      throw new Error('Synthetic fixture no longer matches the attested balance')
    }

    const existing = await tx.payment.findUnique({ where: { legacySourceOrderId: fixtureOrderId } })
    if (existing && (existing.amount.toFixed(2) !== '100000.00' || existing.orderId !== fixtureOrderId)) {
      throw new Error('Existing opening balance conflicts with the fixture')
    }
    if (!existing) {
      await tx.payment.create({
        data: {
          orderId: fixtureOrderId,
          amount: '100000.00',
          method: 'legacy_verified_fixture',
          source: 'legacy_opening_balance',
          legacySourceOrderId: fixtureOrderId,
          occurredAt: order.paidAt,
        },
      })
    }
    if (!order.ledgerReconciledAt) {
      await tx.order.update({
        where: { id: fixtureOrderId },
        data: { ledgerReconciledAt: new Date() },
      })
      await tx.auditEvent.create({
        data: {
          entityType: 'order',
          entityId: fixtureOrderId,
          action: 'synthetic_fixture_balance_reconciled',
          after: { amount: '100000.00', source: 'synthetic-fixture' },
          reason: 'Local migration drill only',
        },
      })
    }
  })
  process.stdout.write('Synthetic opening balance reconciled idempotently.\n')
}

main().finally(() => prisma.$disconnect())
