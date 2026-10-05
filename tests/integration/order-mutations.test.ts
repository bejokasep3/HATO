import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { confirmReceipt, saveReceiptDraft } from '../../src/lib/services/inventory'
import { ServiceError } from '../../src/lib/services/mutation'
import { cancelOrder, editOrder, restoreOrder, updateFulfillment } from '../../src/lib/services/order-mutations'
import { createOrder } from '../../src/lib/services/orders'
import { confirmSupplierRecap } from '../../src/lib/services/supplier-recap'

const prisma = new PrismaClient()
const actorId = '40000000-0000-4000-8000-000000000099'
const periodStart = addCalendarDays('2026-09-28', 7 * (10000 + Math.floor(Math.random() * 10000)))
const monday = new Date(`${periodStart}T05:00:00.000Z`)
const thursday = new Date(`${addCalendarDays(periodStart, 3)}T05:00:00.000Z`)

test('edit, cancel, restore and fulfillment honor payments and physical stock', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.find((product) => product.targetGroup === 'AYAM')!
  const tahu = products.filter((product) => product.targetGroup === 'TAHU')
  const group = await prisma.group.create({ data: { name: 'Kelompok Mutasi Uji', level: 1 } })
  const members = await Promise.all([0, 1].map((index) => prisma.member.create({ data: { name: `Anggota Mutasi Uji ${index}`, phone: `00000000${index}`, level: 1, groupId: group.id } })))
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '10.00' }] })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  const firstItems = [
    { productId: ayam.id, priceType: 'consumer' as const, quantity: '4.00' },
    { productId: tahu[0].id, priceType: 'consumer' as const, quantity: '2.00' },
  ]
  const first = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[0].id, now: monday, items: firstItems })
  const orderId = first.body.id as string
  await confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 3, items: [
    { productId: ayam.id, quantity: '10.00' },
    { productId: tahu[0].id, quantity: '6.00' },
    { productId: tahu[1].id, quantity: '4.00' },
  ] })
  const raised = await editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 0, now: thursday, items: [{ ...firstItems[0], quantity: '5.00' }, firstItems[1]] })
  assert.equal(raised.body.totalAmount, '70000.00')
  await assert.rejects(
    () => editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 1, now: thursday, items: [{ ...firstItems[0], quantity: '11.00' }, firstItems[1]] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INSUFFICIENT_ALLOCATION',
  )
  const second = await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, now: thursday, items: [{ productId: tahu[1].id, priceType: 'consumer', quantity: '2.00' }] })
  const secondId = second.body.id as string
  const cancelKey = randomUUID()
  const cancelled = await cancelOrder(prisma, { actorId, key: cancelKey, id: secondId, expectedVersion: 0, reason: 'Dibatalkan untuk uji' })
  assert.deepEqual(await cancelOrder(prisma, { actorId, key: cancelKey, id: secondId, expectedVersion: 0, reason: 'Dibatalkan untuk uji' }), cancelled)
  const restored = await restoreOrder(prisma, { actorId, key: randomUUID(), id: secondId, expectedVersion: 1, reason: 'Dikembalikan untuk uji', now: thursday })
  assert.equal(restored.body.cancelledAt, null)
  await prisma.payment.create({ data: { orderId: secondId, amount: '20000.00', method: 'cash', actorId } })
  await assert.rejects(
    () => cancelOrder(prisma, { actorId, key: randomUUID(), id: secondId, expectedVersion: 2, reason: 'Tidak boleh' }),
    (error: unknown) => error instanceof ServiceError && error.code === 'PAYMENT_REVERSAL_REQUIRED',
  )
  await assert.rejects(
    () => editOrder(prisma, { actorId, key: randomUUID(), id: secondId, expectedVersion: 2, now: thursday, items: [{ productId: tahu[1].id, priceType: 'consumer', quantity: '1.00' }] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'TOTAL_BELOW_PAID',
  )

  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })
  const draft = await saveReceiptDraft(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: cycle.version, items: [
    { productId: ayam.id, receivedQty: '4.00', damagedQty: '0.00', purchasePrice: '7000.00' },
    { productId: tahu[0].id, receivedQty: '2.00', damagedQty: '0.00', purchasePrice: '4000.00' },
    { productId: tahu[1].id, receivedQty: '2.00', damagedQty: '0.00', purchasePrice: '4000.00' },
  ] })
  await confirmReceipt(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: draft.body.cycleVersion as number })
  await assert.rejects(
    () => updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 1, status: 'shipped' }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_FULFILLMENT_TRANSITION',
  )
  const confirmed = await updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: 1, status: 'confirmed' })
  await assert.rejects(
    () => updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: confirmed.body.version as number, status: 'shipped' }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INSUFFICIENT_PHYSICAL_STOCK',
  )
  const reduced = await editOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: confirmed.body.version as number, now: thursday, items: firstItems })
  assert.equal(reduced.body.totalAmount, '60000.00')
  const shipped = await updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: reduced.body.version as number, status: 'shipped' })
  const delivered = await updateFulfillment(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: shipped.body.version as number, status: 'delivered' })
  assert.equal(delivered.body.orderStatus, 'delivered')
  await assert.rejects(
    () => cancelOrder(prisma, { actorId, key: randomUUID(), id: orderId, expectedVersion: delivered.body.version as number, reason: 'Tidak boleh' }),
    (error: unknown) => error instanceof ServiceError && error.code === 'ORDER_ALREADY_SHIPPED',
  )
})

test.after(async () => prisma.$disconnect())
