import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availability, canChangeAllocation } from '../../src/lib/domain/availability'
import { businessDate, canIncreaseOrder, cycleDates, needsConfirmedRecap } from '../../src/lib/domain/calendar'
import { lineSubtotal, normalizeIndonesianDecimal, parseScaled, sumMoney } from '../../src/lib/domain/money'
import { assertPaymentAllowed, paymentSummary } from '../../src/lib/domain/payments'
import { targetProgress, validateRecapAllocation } from '../../src/lib/domain/targets'

test('A01: siklus dan cutoff memakai kalender WIB', () => {
  assert.deepEqual(cycleDates('2026-10-05'), {
    periodStart: '2026-10-05', supplierDeadline: '2026-10-06',
    deliveryDate: '2026-10-08', periodEnd: '2026-10-11', nextPeriodStart: '2026-10-12',
  })
  assert.equal(businessDate(new Date('2026-10-11T16:59:00Z')), '2026-10-11')
  assert.equal(canIncreaseOrder('2026-10-05', 'open', new Date('2026-10-11T16:59:00Z')), true)
  assert.equal(canIncreaseOrder('2026-10-05', 'open', new Date('2026-10-11T17:00:00Z')), false)
  assert.equal(canIncreaseOrder('2026-10-05', 'closed', new Date('2026-10-06T04:00:00Z')), false)
  assert.equal(needsConfirmedRecap('2026-10-05', false, new Date('2026-10-06T16:59:00Z')), false)
  assert.equal(needsConfirmedRecap('2026-10-05', false, new Date('2026-10-06T17:00:00Z')), true)
  assert.throws(() => cycleDates('2026-10-06'), /CYCLE_MUST_START_MONDAY/)
})

test('A02-A04: target dan pembagian rekap per varian', () => {
  assert.deepEqual(targetProgress('10', '7'), {
    percentage: 70, shortfall: '3.00', excess: '0.00', plannedPurchase: '10.00',
  })
  assert.equal(targetProgress('10', '14').percentage, 140)
  assert.equal(targetProgress('0', '7').percentage, null)
  assert.equal(targetProgress('0', '7').plannedPurchase, '7.00')
  const lines = [
    { productId: 'karkas', groupCode: 'AYAM' as const, demand: '4', proposed: '6' },
    { productId: 'recah', groupCode: 'AYAM' as const, demand: '3', proposed: '4' },
  ]
  assert.doesNotThrow(() => validateRecapAllocation({ AYAM: '10', TAHU: '0' }, lines))
  assert.throws(() => validateRecapAllocation({ AYAM: '10', TAHU: '0' }, [lines[0], { ...lines[1], proposed: '3' }]), /GROUP_TOTAL_MISMATCH/)
  assert.throws(() => validateRecapAllocation({ AYAM: '10', TAHU: '0' }, [lines[0], { ...lines[1], proposed: '2' }]), /BELOW_PRODUCT_DEMAND/)
  assert.throws(() => validateRecapAllocation({ AYAM: '12', TAHU: '0' }, lines), /GROUP_TOTAL_MISMATCH/)
})

test('A05-A07: jatah, shortage dan stok yang sudah dikirim', () => {
  assert.equal(canChangeAllocation('10', '7', '0', '2'), true)
  assert.equal(canChangeAllocation('10', '9', '0', '2'), false)
  assert.equal(canChangeAllocation('10', '9', '2', '3'), true)
  assert.deepEqual(availability('7', '9', '0', 'received'), {
    availableToOrder: '0.00', shortage: '2.00', physicalRemaining: '7.00', reserved: '9.00',
  })
  assert.equal(canChangeAllocation('7', '9', '2', '1'), true)
  assert.equal(canChangeAllocation('7', '9', '2', '3'), false)
  assert.deepEqual(availability('10', '7', '4', 'received'), {
    availableToOrder: '3.00', shortage: '0.00', physicalRemaining: '6.00', reserved: '3.00',
  })
})

test('A09: pembayaran cicilan dan reversal dihitung dari ledger efektif', () => {
  const entries = [
    { amount: '50000', reversed: false },
    { amount: '40000', reversed: false },
    { amount: '60000', reversed: false },
  ]
  assert.deepEqual(paymentSummary('150000', entries, true), {
    status: 'paid', paidAmount: '150000.00', outstandingAmount: '0.00',
  })
  assert.throws(() => assertPaymentAllowed('0', '1'), /PAYMENT_EXCEEDS_OUTSTANDING/)
  entries[1].reversed = true
  assert.equal(paymentSummary('150000', entries, true).outstandingAmount, '40000.00')
  assert.equal(paymentSummary('150000', entries, false).status, 'unverified')
})

test('A21: harga dan quantity tepat dua desimal tanpa float', () => {
  assert.equal(lineSubtotal('10000.02', '0.25'), '2500.01')
  assert.equal(sumMoney(['2500.01', '2500.01']), '5000.02')
  assert.equal(normalizeIndonesianDecimal('1,5'), '1.50')
  assert.throws(() => parseScaled('1.5', 0, 8), /FRACTION_NOT_ALLOWED/)
  assert.throws(() => parseScaled('-1', 2, 8), /INVALID_DECIMAL/)
  assert.throws(() => parseScaled('NaN', 2, 8), /INVALID_DECIMAL/)
  assert.throws(() => lineSubtotal('0', '1'), /ZERO_NOT_ALLOWED/)
  assert.throws(() => sumMoney(['9999999999.99', '0.01']), /MONEY_OVERFLOW/)
})
