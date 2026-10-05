import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCycleDetail, parseMembers, parseOrders, parsePrices, parseProducts } from '../../mobile/lib/legacy-adapters'

const id = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'

test('A10: detail cycle dibuka dari envelope {cycle,recap}', () => {
  const detail = parseCycleDetail({
    cycle: {
      id, label: '5-11 Okt', status: 'open', periodStart: '2026-10-05',
      orderDeadline: '2026-10-06', deliveryDate: '2026-10-08',
      weeklyPrices: [], rotationSchedules: [], orders: [],
    },
    recap: [],
  })
  assert.equal(detail.id, id)
  assert.equal(detail.label, '5-11 Okt')
  assert.deepEqual(detail.orders, [])
})

test('A10: harga siklus memakai relasi produk dan kedua jenis harga', () => {
  const prices = parsePrices([{
    id: secondId, cycleId: id, productId: secondId, price: 20000,
    consumerPrice: 21000, traderPrice: 19000, product: { name: 'Ayam Karkas' },
  }])
  assert.equal(prices[0].productName, 'Ayam Karkas')
  assert.equal(prices[0].consumerPrice, 21000)
  assert.equal(prices[0].traderPrice, 19000)
})

test('A10: respons harga salah bentuk gagal dengan jelas', () => {
  assert.throws(() => parsePrices([{ id: secondId, price: 20000 }]))
})

test('A10: anggota, produk dan order mengambil relasi nested', () => {
  const members = parseMembers([{ id, name: 'Fixture A', phone: '00000000', groupId: secondId, role: 'anggota', group: { name: 'Grup Uji' } }])
  assert.equal(members[0].groupName, 'Grup Uji')

  const products = parseProducts([{ id: secondId, name: 'Tahu Putih', unit: 'bungkus', isActive: true }])
  assert.equal(products[0].unit, 'bungkus')
  assert.equal('defaultPrice' in products[0], false)

  const orders = parseOrders([{
    id, cycleId: secondId, memberId: id, totalAmount: '150000.00',
    paymentStatus: 'unpaid', orderStatus: 'pending', createdAt: '2026-10-05T00:00:00Z',
    member: { name: 'Fixture A', group: { name: 'Grup Uji' } },
  }])
  assert.equal(orders[0].memberName, 'Fixture A')
  assert.equal(orders[0].groupName, 'Grup Uji')
  assert.equal(orders[0].totalAmount, 150000)
})
