import { formatScaled, parseScaled } from './money'

export type PaymentEntry = { amount: string; reversed: boolean }

export function paymentSummary(totalAmount: string, entries: readonly PaymentEntry[], reconciled: boolean) {
  if (!reconciled) return { status: 'unverified' as const, paidAmount: null, outstandingAmount: null }
  const total = parseScaled(totalAmount, 2, 10)
  const paid = entries.reduce((sum, entry) => sum + (entry.reversed ? 0n : parseScaled(entry.amount, 2, 10, false)), 0n)
  if (paid > total) throw new Error('PAYMENT_EXCEEDS_TOTAL')
  return {
    status: (paid === 0n ? 'unpaid' : paid === total ? 'paid' : 'partial') as 'unpaid' | 'partial' | 'paid',
    paidAmount: formatScaled(paid),
    outstandingAmount: formatScaled(total - paid),
  }
}

export function assertPaymentAllowed(outstanding: string, amount: string): void {
  const available = parseScaled(outstanding, 2, 10)
  const requested = parseScaled(amount, 2, 10, false)
  if (requested > available) throw new Error('PAYMENT_EXCEEDS_OUTSTANDING')
}
