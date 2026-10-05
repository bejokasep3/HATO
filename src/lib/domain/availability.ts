import { formatScaled, parseScaled } from './money'

export function availability(capacity: string, allocated: string, shipped: string, source: 'planned' | 'received') {
  const c = parseScaled(capacity, 2, 8)
  const a = parseScaled(allocated, 2, 8)
  const d = parseScaled(shipped, 2, 8)
  if (d > a) throw new Error('SHIPPED_EXCEEDS_ALLOCATION')
  const balance = c - a
  return {
    availableToOrder: formatScaled(balance > 0n ? balance : 0n),
    shortage: formatScaled(balance < 0n ? -balance : 0n),
    physicalRemaining: source === 'received' ? formatScaled(c - d) : null,
    reserved: formatScaled(a - d),
  }
}

export function canChangeAllocation(capacity: string, totalAllocated: string, oldQuantity: string, newQuantity: string): boolean {
  const c = parseScaled(capacity, 2, 8)
  const total = parseScaled(totalAllocated, 2, 8)
  const oldValue = parseScaled(oldQuantity, 2, 8)
  const next = parseScaled(newQuantity, 2, 8)
  if (oldValue > total) throw new Error('OLD_ALLOCATION_EXCEEDS_TOTAL')
  return next <= oldValue || c - (total - oldValue) >= next
}
