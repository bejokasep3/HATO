import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'

const prisma = new PrismaClient()

test('legacy fixture is preserved and only attested balance is reconciled', async () => {
  await assertIsolatedTestDatabase(prisma)
  const [cycles, orders, payments, audits, receipts, unknownProducts] = await Promise.all([
    prisma.cycle.findMany({ select: { weekKey: true, rulesVersion: true } }),
    prisma.order.findMany({ select: { totalAmount: true, ledgerReconciledAt: true } }),
    prisma.payment.findMany({ select: { amount: true, source: true } }),
    prisma.auditEvent.count({ where: { action: 'synthetic_fixture_balance_reconciled' } }),
    prisma.goodsReceipt.findMany({ select: { status: true, confirmedAt: true } }),
    prisma.product.count({ where: { targetGroup: null } }),
  ])

  assert.equal(cycles.length, 2)
  assert(cycles.every((cycle) => cycle.weekKey === null && cycle.rulesVersion === null))
  assert.equal(orders.length, 1)
  assert.equal(orders[0].totalAmount.toFixed(2), '100000.00')
  assert(orders[0].ledgerReconciledAt instanceof Date)
  assert.equal(payments.length, 1)
  assert.equal(payments[0].amount.toFixed(2), '100000.00')
  assert.equal(payments[0].source, 'legacy_opening_balance')
  assert.equal(audits, 1)
  assert.deepEqual(receipts, [{ status: 'draft', confirmedAt: null }])
  assert.equal(unknownProducts, 1)
})

test('new business tables have RLS and database constraints', async () => {
  await assertIsolatedTestDatabase(prisma)
  const tables = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relname IN ('cycle_targets', 'supplier_recaps', 'supplier_recap_items',
                      'payments', 'mutation_requests', 'audit_events')
  `
  assert.equal(tables.length, 6)
  assert(tables.every((table) => table.relrowsecurity))

  const constraints = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('payments_positive_amount', 'cycle_targets_nonnegative_quantity',
                      'cycle_targets_group_unit', 'cycles_week_key_monday')
  `
  assert.equal(constraints.length, 4)
  const [publicPayments] = await prisma.$queryRaw<{ granted: boolean }[]>`
    SELECT has_table_privilege('public', 'public.payments', 'SELECT') AS granted
  `
  assert.equal(publicPayments.granted, false)
})

test.after(async () => prisma.$disconnect())
