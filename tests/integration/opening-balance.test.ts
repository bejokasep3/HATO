import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { confirmOpeningBalanceSchema } from '../../shared/contracts/payments'
import { ServiceError } from '../../src/lib/services/mutation'
import { addPayment, confirmOpeningBalance, getOrderPayments, getReceivables } from '../../src/lib/services/payments'

const prisma = new PrismaClient()
const actorId = '50000000-0000-4000-8000-000000000099'

test('legacy balances require explicit confirmation and preserve historical billing', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const group = await prisma.group.create({ data: { name: 'Opening balance fixture', level: 1 } })
  const cycle = await prisma.cycle.create({ data: {
    label: 'Legacy opening fixture', periodStart: new Date('2020-01-06'),
    orderDeadline: new Date('2020-01-09'), deliveryDate: new Date('2020-01-10'), status: 'completed',
  } })
  const newOrder = async (extra = {}) => {
    const member = await prisma.member.create({ data: { name: 'Synthetic member', phone: '000', level: 1, groupId: group.id } })
    return prisma.order.create({ data: { cycleId: cycle.id, memberId: member.id, totalAmount: '77000', ...extra } })
  }
  const confirm = (order: { id: string; version: number }, paidAmount: string, key = randomUUID()) => confirmOpeningBalance(prisma, {
    actorId, key, orderId: order.id, expectedVersion: order.version, paidAmount, reason: 'Checked synthetic historical book',
  })
  const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof ServiceError && error.code === code)

  const unpaid = await newOrder()
  assert.equal((await getOrderPayments(prisma, unpaid.id)).canConfirmOpeningBalance, true)
  await rejects(confirm(unpaid, '-1'), 'INVALID_OPENING_AMOUNT')
  await rejects(confirm(unpaid, '77001'), 'OPENING_EXCEEDS_TOTAL')
  await rejects(confirm({ ...unpaid, version: 1 }, '0'), 'STALE_VERSION')
  assert.equal(await prisma.payment.count({ where: { orderId: unpaid.id } }), 0)
  await confirm(unpaid, '0')
  const unpaidView = await getOrderPayments(prisma, unpaid.id)
  assert.equal(unpaidView.summary.status, 'unpaid')
  assert.equal(unpaidView.summary.outstandingAmount, '77000.00')
  assert.equal(unpaidView.payments.length, 0)
  assert.equal(unpaidView.canConfirmOpeningBalance, false)
  await rejects(confirm({ ...unpaid, version: unpaidView.version }, '0'), 'BALANCE_ALREADY_CONFIRMED')

  const partial = await newOrder()
  const key = randomUUID()
  const result = await confirm(partial, '30000', key)
  assert.deepEqual(await confirm(partial, '30000.00', key), result)
  const history = await getOrderPayments(prisma, partial.id)
  assert.equal(history.summary.outstandingAmount, '47000.00')
  assert.equal(history.payments.length, 1)
  assert.equal(history.payments[0].source, 'legacy_opening_balance')
  assert.equal(history.payments[0].occurredAt, null)
  assert.equal(history.payments[0].note, 'Checked synthetic historical book')
  const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: partial.id, action: 'opening_balance_confirmed' } })
  assert.equal(audit.actorId, actorId)
  assert.equal(audit.reason, 'Checked synthetic historical book')
  const saved = await prisma.order.findUniqueOrThrow({ where: { id: partial.id } })
  assert.equal(saved.totalAmount.toFixed(2), '77000.00')
  assert.equal(saved.cycleId, partial.cycleId)
  assert.equal(saved.paidAt, null)
  await addPayment(prisma, { actorId, key: randomUUID(), orderId: partial.id, amount: '47000', method: 'cash' })
  assert.equal((await getOrderPayments(prisma, partial.id)).summary.status, 'paid')

  const paidAt = new Date('2020-01-11T10:00:00Z')
  const full = await newOrder({ paidAt })
  await confirm(full, '77000')
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: full.id } })).paidAt?.toISOString(), paidAt.toISOString())
  const receivables = await getReceivables(prisma, { page: 1, pageSize: 20, cycleId: cycle.id })
  assert.equal(receivables.totalCount, 1)
  assert.equal(receivables.totalKnownOutstanding, '77000.00')

  const concurrent = await newOrder()
  const attempts = await Promise.allSettled([confirm(concurrent, '1000'), confirm(concurrent, '2000')])
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1)
  assert.equal(await prisma.payment.count({ where: { orderId: concurrent.id } }), 1)
  await rejects(confirm(await newOrder({ cancelledAt: new Date() }), '0'), 'ORDER_CANCELLED')
  const existing = await newOrder()
  await prisma.payment.create({ data: { orderId: existing.id, amount: '1', actorId, method: 'cash' } })
  await rejects(confirm(existing, '0'), 'EXISTING_LEDGER_ENTRIES')
  await prisma.cycle.update({ where: { id: cycle.id }, data: { rulesVersion: 2 } })
  await rejects(confirm(await newOrder(), '0'), 'NOT_LEGACY_ORDER')
})

test('opening balance contract accepts zero and rejects ambiguous confirmations', () => {
  const valid = { expectedVersion: 0, paidAmount: '0', reason: 'Checked book' }
  assert.equal(confirmOpeningBalanceSchema.safeParse(valid).success, true)
  for (const invalid of [{ ...valid, paidAmount: '-1' }, { ...valid, reason: ' ' }, { ...valid, paid: true }, { ...valid, expectedVersion: -1 }]) {
    assert.equal(confirmOpeningBalanceSchema.safeParse(invalid).success, false)
  }
})

test.after(async () => prisma.$disconnect())
