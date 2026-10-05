import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCycleSchema } from '../../shared/contracts/cycles'
import { availabilityItemSchema } from '../../shared/contracts/inventory'
import { createOrderV2Schema, orderV2Schema } from '../../shared/contracts/orders'
import { createPaymentSchema } from '../../shared/contracts/payments'

const id = '11111111-1111-4111-8111-111111111111'

test('Cycle requires explicit, separate group targets', () => {
  assert.equal(createCycleSchema.safeParse({ periodStart: '2026-10-05', targets: [] }).success, false)
  assert.equal(createCycleSchema.safeParse({
    periodStart: '2026-10-05',
    targets: [{ groupCode: 'AYAM', quantity: '10' }, { groupCode: 'TAHU', quantity: '10' }],
  }).success, true)
})

test('Order contract rejects client price/payment and duplicate items', () => {
  const input = { cycleId: id, memberId: id, items: [{ productId: id, quantity: '1.50', priceType: 'consumer' }] }
  assert.equal(createOrderV2Schema.safeParse(input).success, true)
  assert.equal(createOrderV2Schema.safeParse({ ...input, items: [...input.items, ...input.items] }).success, false)
  assert.equal(createOrderV2Schema.safeParse({ ...input, items: [{ ...input.items[0], quantity: '-1' }] }).success, false)
  assert.equal(createOrderV2Schema.safeParse({ ...input, unitPrice: '0' }).success, false)
})

test('Response shape mismatch fails instead of silently producing zero', () => {
  assert.equal(orderV2Schema.safeParse({ id, totalAmount: '0' }).success, false)
  assert.equal(availabilityItemSchema.safeParse({
    productId: id, capacity: null, allocated: '0', availableToOrder: null, shortage: null, source: 'unknown',
  }).success, true)
  assert.equal(availabilityItemSchema.safeParse({
    productId: id, capacity: 0, allocated: '0', availableToOrder: 0, shortage: 0, source: 'received',
  }).success, false)
})

test('Payment payload requires positive amount and explicit method', () => {
  assert.equal(createPaymentSchema.safeParse({ amount: '40000', method: 'transfer' }).success, true)
  assert.equal(createPaymentSchema.safeParse({ amount: '0', method: 'transfer' }).success, false)
  assert.equal(createPaymentSchema.safeParse({ amount: '1', method: 'transfer', occurredAt: 'not a date' }).success, false)
})
