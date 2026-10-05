import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedTestDatabase } from '../../scripts/migration/test-db'
import { addCalendarDays } from '../../src/lib/domain/calendar'
import { changeTargets, createCycle, openCycle, setCyclePrices } from '../../src/lib/services/cycles'
import { ServiceError } from '../../src/lib/services/mutation'
import { confirmSupplierRecap, getSupplierRecap } from '../../src/lib/services/supplier-recap'

const prisma = new PrismaClient()
const actorId = '10000000-0000-4000-8000-000000000099'
const periodStart = addCalendarDays('2026-09-28', 7 * (500 + Math.floor(Math.random() * 100000)))
const target10 = [{ groupCode: 'AYAM' as const, quantity: '10.00' }, { groupCode: 'TAHU' as const, quantity: '10.00' }]

test('recap requires a fresh version, exact allocation, and preserves snapshot', async () => {
  await assertIsolatedTestDatabase(prisma, 'hato_recap')
  const group = await prisma.group.create({ data: { name: 'Kelompok Rekap Uji', level: 1 } })
  const member = await prisma.member.create({ data: { name: 'Anggota Rekap Uji', phone: '0000000000', level: 1, groupId: group.id } })
  const products = await Promise.all([
    prisma.product.create({ data: { name: 'Ayam A Uji', unit: 'kg', targetGroup: 'AYAM', quantityScale: 2 } }),
    prisma.product.create({ data: { name: 'Ayam B Uji', unit: 'kg', targetGroup: 'AYAM', quantityScale: 2 } }),
    prisma.product.create({ data: { name: 'Tahu A Uji', unit: 'bungkus', targetGroup: 'TAHU', quantityScale: 0 } }),
    prisma.product.create({ data: { name: 'Tahu B Uji', unit: 'bungkus', targetGroup: 'TAHU', quantityScale: 0 } }),
  ])
  const [ayamA, ayamB, tahuA, tahuB] = products
  const created = await createCycle(prisma, { actorId, key: randomUUID(), periodStart, targets: target10 })
  const cycleId = created.body.id as string
  const priced = await setCyclePrices(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 0, items: products.map((product) => ({ productId: product.id, consumerPrice: '10000.00', traderPrice: '10000.00' })) })
  assert.equal(priced.body.version, 1)
  const opened = await openCycle(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: 1 })
  assert.equal(opened.body.version, 2)
  const initialPreview = await getSupplierRecap(prisma, cycleId)
  assert.equal(initialPreview.confirmed, null)
  assert.equal(initialPreview.groups[0].plannedPurchase, '10.00')

  await prisma.order.create({ data: {
    cycleId, memberId: member.id, totalAmount: '110000.00', ledgerReconciledAt: new Date(),
    items: { create: [
      { productId: ayamA.id, priceType: 'consumer', quantity: '4.00', unitPrice: '10000.00', subtotal: '40000.00' },
      { productId: ayamB.id, priceType: 'trader', quantity: '3.00', unitPrice: '10000.00', subtotal: '30000.00' },
      { productId: tahuA.id, priceType: 'consumer', quantity: '4.00', unitPrice: '10000.00', subtotal: '40000.00' },
    ] },
  } })
  await prisma.cycle.update({ where: { id: cycleId }, data: { version: { increment: 1 } } })
  const allocation = [
    { productId: ayamA.id, quantity: '6.00' },
    { productId: ayamB.id, quantity: '4.00' },
    { productId: tahuA.id, quantity: '6.00' },
    { productId: tahuB.id, quantity: '4.00' },
  ]
  await assert.rejects(
    () => confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: initialPreview.cycleVersion, items: allocation }),
    (error: unknown) => error instanceof ServiceError && error.code === 'STALE_VERSION',
  )
  const current = await getSupplierRecap(prisma, cycleId)
  assert.equal(current.groups.find((group) => group.groupCode === 'AYAM')?.demand, '7.00')
  assert.equal(current.groups.find((group) => group.groupCode === 'TAHU')?.demand, '4.00')
  await assert.rejects(
    () => confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: current.cycleVersion, items: [{ ...allocation[0], quantity: '5.00' }, ...allocation.slice(1)] }),
    (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_RECAP_ALLOCATION',
  )
  const key = randomUUID()
  const confirmed = await confirmSupplierRecap(prisma, { actorId, key, id: cycleId, expectedVersion: current.cycleVersion, items: allocation })
  assert.equal(confirmed.status, 201)
  const replay = await confirmSupplierRecap(prisma, { actorId, key, id: cycleId, expectedVersion: current.cycleVersion, items: allocation })
  assert.deepEqual(replay, confirmed)
  assert.equal(await prisma.supplierRecap.count({ where: { cycleId } }), 1)
  await assert.rejects(
    () => confirmSupplierRecap(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: current.cycleVersion + 1, items: allocation }),
    (error: unknown) => error instanceof ServiceError && error.code === 'RECAP_ALREADY_CONFIRMED',
  )

  const changed = await changeTargets(prisma, { actorId, key: randomUUID(), id: cycleId, expectedVersion: current.cycleVersion + 1, reason: 'Target dinaikkan', targets: [{ groupCode: 'AYAM', quantity: '12.00' }, target10[1]] })
  assert.equal(changed.body.version, current.cycleVersion + 2)
  await prisma.product.update({ where: { id: ayamA.id }, data: { name: 'Ayam A Berganti Nama' } })
  const after = await getSupplierRecap(prisma, cycleId)
  assert.equal(after.groups.find((group) => group.groupCode === 'AYAM')?.target, '12.00')
  const snapshot = after.confirmed!
  assert.deepEqual(snapshot.targetSnapshot, [
    { groupCode: 'AYAM', quantity: '10.00', unit: 'kg' },
    { groupCode: 'TAHU', quantity: '10.00', unit: 'bungkus' },
  ])
  assert(snapshot.items.some((item) => item.productName === 'Ayam A Uji' && item.quantity === '6.00'))
  assert(snapshot.whatsappText.includes('Ayam A Uji: 6.00 kg'))
  assert(!snapshot.whatsappText.includes('Berganti Nama'))
})

test.after(async () => prisma.$disconnect())
