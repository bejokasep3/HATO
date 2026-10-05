import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { getCycleAvailability } from '../../src/lib/services/availability'
import { createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { ServiceError } from '../../src/lib/services/mutation'
import { createOrder } from '../../src/lib/services/orders'
import { confirmSupplierRecap } from '../../src/lib/services/supplier-recap'

const prisma = new PrismaClient()
const actorId = '20000000-0000-4000-8000-000000000099'
const periodStart = addCalendarDays('2026-09-28', 7 * (110000 + Math.floor(Math.random() * 100000)))
const atDay = (day: number) => new Date(`${addCalendarDays(periodStart, day)}T05:00:00.000Z`)

test('order allocation is enforced per variant and concurrent requests cannot oversubscribe', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.filter((product) => product.targetGroup === 'AYAM')
  const tahu = products.filter((product) => product.targetGroup === 'TAHU')
  assert.equal(ayam.length, 2)
  assert.equal(tahu.length, 2)
  const group = await prisma.group.create({ data: { name: 'Kelompok Order Uji', level: 1 } })
  const members = await Promise.all(Array.from({ length: 4 }, (_, index) => prisma.member.create({
    data: { name: `Anggota Order Uji ${index}`, phone: `00000000${index}`, level: 1, groupId: group.id },
  })))
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '10.00' }] })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })

  const firstKey = randomUUID()
  const firstInput = { actorId, key: firstKey, cycleId, memberId: members[0].id, now: atDay(0), items: [
    { productId: ayam[0].id, priceType: 'consumer' as const, quantity: '4.00' },
    { productId: tahu[0].id, priceType: 'consumer' as const, quantity: '2.00' },
  ] }
  const first = await createOrder(prisma, firstInput)
  assert.equal(first.status, 201)
  assert.equal(first.body.totalAmount, '60000.00')
  assert.deepEqual(await createOrder(prisma, firstInput), first)
  const beforeRecap = await getCycleAvailability(prisma, cycleId)
  assert.equal(beforeRecap.items[0].source, 'unknown')
  await assert.rejects(
    () => createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[1].id, now: atDay(2), items: [{ productId: ayam[0].id, priceType: 'consumer', quantity: '1.00' }] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'RECAP_REQUIRED',
  )

  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })
  await confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: cycle.version, items: [
    { productId: ayam[0].id, quantity: '7.00' }, { productId: ayam[1].id, quantity: '3.00' },
    { productId: tahu[0].id, quantity: '6.00' }, { productId: tahu[1].id, quantity: '4.00' },
  ] })
  const planned = await getCycleAvailability(prisma, cycleId)
  const ayamRow = planned.items.find((item) => item.productId === ayam[0].id)!
  assert.equal(ayamRow.source, 'planned')
  assert.equal(ayamRow.capacity, '7.00')
  assert.equal(ayamRow.allocated, '4.00')
  assert.equal(ayamRow.availableToOrder, '3.00')

  const results = await Promise.allSettled([members[1], members[2]].map((member) => createOrder(prisma, {
    actorId, key: randomUUID(), cycleId, memberId: member.id, now: atDay(3),
    items: [{ productId: ayam[0].id, priceType: 'consumer', quantity: '2.00' }],
  })))
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const after = await getCycleAvailability(prisma, cycleId)
  assert.equal(after.items.find((item) => item.productId === ayam[0].id)?.allocated, '6.00')
  assert.equal(after.items.find((item) => item.productId === ayam[0].id)?.availableToOrder, '1.00')
  await assert.rejects(
    () => createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[3].id, now: atDay(3), items: [{ productId: ayam[0].id, priceType: 'consumer', quantity: '2.00' }] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INSUFFICIENT_ALLOCATION',
  )
  await assert.rejects(
    () => createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: members[3].id, now: atDay(3), items: [{ productId: tahu[0].id, priceType: 'consumer', quantity: '1.50' }] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_QUANTITY',
  )
})

test('recap confirmation and a new order serialize on the same cycle row', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.find((product) => product.targetGroup === 'AYAM')!
  const group = await prisma.group.create({ data: { name: 'Kelompok Race Uji', level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Anggota Race Uji', phone: '0000000000', level: 1, groupId: group.id } })
  const nextWeek = addCalendarDays(periodStart, 7)
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart: nextWeek, targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '0.00' }] })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  const outcomes = await Promise.allSettled([
    createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: member.id, now: new Date(`${nextWeek}T05:00:00.000Z`), items: [{ productId: ayam.id, priceType: 'consumer', quantity: '11.00' }] }),
    confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 2, items: [{ productId: ayam.id, quantity: '10.00' }] }),
  ])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
  const orderCount = await prisma.order.count({ where: { cycleId } })
  const recapCount = await prisma.supplierRecap.count({ where: { cycleId } })
  assert.equal(orderCount + recapCount, 1)
})

test.after(async () => prisma.$disconnect())
