import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from './test-db'

const prisma = new PrismaClient()

async function main() {
  await assertIsolatedTestDatabase(prisma)

  const [orders, products, cycles, receipts, payments, duplicates] = await Promise.all([
    prisma.order.aggregate({ _count: true, _sum: { totalAmount: true } }),
    prisma.product.count({ where: { targetGroup: null } }),
    prisma.cycle.count({ where: { rulesVersion: null } }),
    prisma.goodsReceipt.groupBy({ by: ['status'], _count: true }),
    prisma.payment.aggregate({ _count: true, _sum: { amount: true } }),
    prisma.$queryRaw<{ period_start: Date; count: bigint }[]>`
      SELECT period_start, COUNT(*) AS count
      FROM cycles GROUP BY period_start HAVING COUNT(*) > 1
    `,
  ])

  const byStatus = await prisma.order.groupBy({
    by: ['paymentStatus'],
    _count: true,
    _sum: { totalAmount: true },
  })
  const unreconciled = await prisma.order.count({ where: { ledgerReconciledAt: null } })

  process.stdout.write(JSON.stringify({
    orderCount: orders._count,
    orderTotal: orders._sum.totalAmount?.toFixed(2) ?? '0.00',
    legacyPaymentStatus: byStatus.map((row) => ({
      status: row.paymentStatus,
      count: row._count,
      total: row._sum.totalAmount?.toFixed(2) ?? '0.00',
    })),
    unreconciledOrderCount: unreconciled,
    unknownProductGroupCount: products,
    unknownCycleRulesCount: cycles,
    receiptStatusCounts: receipts.map((row) => ({ status: row.status, count: row._count })),
    duplicatePeriodStartGroups: duplicates.length,
    paymentCount: payments._count,
    paymentTotal: payments._sum.amount?.toFixed(2) ?? '0.00',
  }, null, 2) + '\n')
}

main().finally(() => prisma.$disconnect())
