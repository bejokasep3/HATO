import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { getCycleAvailability } from '../../src/lib/services/availability'
import { createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { confirmReceipt, saveReceiptDraft } from '../../src/lib/services/inventory'
import { ServiceError } from '../../src/lib/services/mutation'
import { createOrder } from '../../src/lib/services/orders'
import { confirmSupplierRecap } from '../../src/lib/services/supplier-recap'

const prisma = new PrismaClient()
const actorId = '30000000-0000-4000-8000-000000000099'
const periodStart = addCalendarDays('2026-09-28', 7 * (220000 + Math.floor(Math.random() * 100000)))

test('draft receipt does not change capacity; confirmed shortage remains visible', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const products = await prisma.product.findMany({ where: { isActive: true } })
  const ayam = products.find((product) => product.targetGroup === 'AYAM')!
  const tahu = products.find((product) => product.targetGroup === 'TAHU')!
  const group = await prisma.group.create({ data: { name: 'Kelompok Terima Uji', level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Anggota Terima Uji', phone: '0000000000', level: 1, groupId: group.id } })
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: [{ groupCode: 'AYAM', quantity: '10.00' }, { groupCode: 'TAHU', quantity: '10.00' }] })
  const cycleId = created.body.id as string
  await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  await createOrder(prisma, { actorId, key: randomUUID(), cycleId, memberId: member.id, now: new Date(`${periodStart}T05:00:00.000Z`), items: [{ productId: ayam.id, priceType: 'consumer', quantity: '9.00' }] })
  await confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 3, items: [{ productId: ayam.id, quantity: '10.00' }, { productId: tahu.id, quantity: '10.00' }] })

  const partial = await saveReceiptDraft(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: 4, items: [{ productId: ayam.id, receivedQty: '8.00', damagedQty: '1.00', purchasePrice: '7000.00' }] })
  assert.equal(partial.body.cycleVersion, 5)
  const whileDraft = await getCycleAvailability(prisma, cycleId)
  assert.equal(whileDraft.items.find((item) => item.productId === ayam.id)?.source, 'planned')
  assert.equal(whileDraft.items.find((item) => item.productId === ayam.id)?.availableToOrder, '1.00')
  await assert.rejects(
    () => confirmReceipt(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: 5 }),
    (error: unknown) => error instanceof ServiceError && error.code === 'RECEIPT_ITEMS_MISSING',
  )
  const full = await saveReceiptDraft(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: 5, items: [
    { productId: ayam.id, receivedQty: '8.00', damagedQty: '1.00', purchasePrice: '7000.00' },
    { productId: tahu.id, receivedQty: '0.00', damagedQty: '0.00', purchasePrice: '4000.00' },
  ] })
  assert.equal(full.body.cycleVersion, 6)
  const key = randomUUID()
  const confirmed = await confirmReceipt(prisma, { actorId, key, cycleId, expectedVersion: 6 })
  assert.equal(confirmed.body.status, 'confirmed')
  assert.deepEqual(await confirmReceipt(prisma, { actorId, key, cycleId, expectedVersion: 6 }), confirmed)
  const after = await getCycleAvailability(prisma, cycleId)
  const ayamRow = after.items.find((item) => item.productId === ayam.id)!
  assert.equal(ayamRow.source, 'received')
  assert.equal(ayamRow.capacity, '7.00')
  assert.equal(ayamRow.allocated, '9.00')
  assert.equal(ayamRow.shortage, '2.00')
  assert.equal(ayamRow.availableToOrder, '0.00')
  const receipt = await prisma.goodsReceipt.findUniqueOrThrow({ where: { cycleId }, include: { items: true } })
  assert.equal(receipt.items.find((item) => item.productId === ayam.id)?.orderedQty.toFixed(2), '10.00')
  await assert.rejects(
    () => saveReceiptDraft(prisma, { actorId, key: randomUUID(), cycleId, expectedVersion: 7, items: [] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'RECEIPT_CONFIRMED',
  )
})

test.after(async () => prisma.$disconnect())
