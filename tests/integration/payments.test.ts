import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { closeCycle, createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { ServiceError } from '../../src/lib/services/mutation'
import { editOrder } from '../../src/lib/services/order-mutations'
import { createOrder } from '../../src/lib/services/orders'
import { addPayment, getOrderPayments, getReceivables, reversePayment } from '../../src/lib/services/payments'

const prisma = new PrismaClient()
const actorId = '50000000-0000-4000-8000-000000000099'
const periodStart = addCalendarDays('2026-09-28', 7 * (20000 + Math.floor(Math.random() * 10000)))
const monday = new Date(`${periodStart}T05:00:00.000Z`)

test('installments, reversal and closed-cycle receivables use a locked ledger', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.find((product) => product.targetGroup === 'AYAM')!
  const group = await prisma.group.create({ data: { name: 'Kelompok Bayar Uji', level: 1 } })
  const members = await Promise.all([0, 1, 2].map((index) => prisma.member.create({ data: { name: `Anggota Bayar Uji ${index}`, phone: `00000000${index}`, level: 1, groupId: group.id } })))
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '10.00' }] })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  const inputItem = { productId: ayam.id, priceType: 'consumer' as const, quantity: '10.00' }
  const first = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[0].id, now: monday, items: [inputItem] })
  const second = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, now: monday, items: [inputItem] })
  const firstId = first.body.id as string
  const secondId = second.body.id as string
  await closeCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 4 })

  const firstKey = randomUUID()
  const installment = await addPayment(prisma, { actorId, key: firstKey, orderId: firstId, amount: '40000.00', method: 'cash', note: 'Cicilan pertama' })
  assert.equal((installment.body.summary as { status: string }).status, 'partial')
  assert.deepEqual(await addPayment(prisma, { actorId, key: firstKey, orderId: firstId, amount: '40000.00', method: 'cash', note: 'Cicilan pertama' }), installment)
  const contenders = await Promise.allSettled([0, 1].map(() => addPayment(prisma, { actorId, key: randomUUID(), orderId: firstId, amount: '40000.00', method: 'transfer' })))
  assert.equal(contenders.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(contenders.filter((result) => result.status === 'rejected').length, 1)
  const history = await getOrderPayments(prisma, firstId)
  assert.equal(history.payments.length, 2)
  assert.equal(history.summary.paidAmount, '80000.00')
  assert.equal(history.summary.outstandingAmount, '20000.00')

  const reverseKey = randomUUID()
  const reversed = await reversePayment(prisma, { actorId, key: reverseKey, paymentId: installment.body.id as string, reason: 'Salah catat untuk uji' })
  assert.equal((reversed.body.summary as { outstandingAmount: string }).outstandingAmount, '60000.00')
  assert.deepEqual(await reversePayment(prisma, { actorId, key: reverseKey, paymentId: installment.body.id as string, reason: 'Salah catat untuk uji' }), reversed)
  await assert.rejects(
    () => reversePayment(prisma, { actorId, key: randomUUID(), paymentId: installment.body.id as string, reason: 'Duplikat' }),
    (error: unknown) => error instanceof ServiceError && error.code === 'PAYMENT_ALREADY_REVERSED',
  )

  const editVsPay = await Promise.allSettled([
    addPayment(prisma, { actorId, key: randomUUID(), orderId: secondId, amount: '80000.00', method: 'cash' }),
    editOrder(prisma, { actorId, key: randomUUID(), id: secondId, expectedVersion: 0, items: [{ ...inputItem, quantity: '5.00' }], now: monday }),
  ])
  assert.equal(editVsPay.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(editVsPay.filter((result) => result.status === 'rejected').length, 1)
  const secondSummary = (await getOrderPayments(prisma, secondId)).summary
  assert(secondSummary.status !== 'unverified')
  assert(Number(secondSummary.paidAmount) <= Number((await prisma.order.findUniqueOrThrow({ where: { id: secondId } })).totalAmount))

  await prisma.order.create({ data: { cycleId, memberId: members[2].id, totalAmount: '50000.00', paymentStatus: 'unpaid', orderStatus: 'pending' } })
  const receivables = await getReceivables(prisma, { page: 1, pageSize: 10, cycleId })
  assert.equal(receivables.unreconciledOrderCount, 1)
  assert.equal(receivables.totalIncomplete, true)
  assert.equal(receivables.totalCount, 2)
  assert.equal(receivables.items.length, 2)
  assert.equal(receivables.items.reduce((sum, item) => sum + Number(item.outstandingAmount), 0).toFixed(2), receivables.totalKnownOutstanding)
})

test.after(async () => prisma.$disconnect())
