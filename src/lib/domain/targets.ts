import { formatScaled, parseScaled } from './money'

export function targetProgress(target: string, demand: string) {
  const targetHundredths = parseScaled(target, 2, 8)
  const demandHundredths = parseScaled(demand, 2, 8)
  return {
    percentage: targetHundredths === 0n ? null : Number(demandHundredths * 10000n / targetHundredths) / 100,
    shortfall: formatScaled(targetHundredths > demandHundredths ? targetHundredths - demandHundredths : 0n),
    excess: formatScaled(demandHundredths > targetHundredths ? demandHundredths - targetHundredths : 0n),
    plannedPurchase: formatScaled(demandHundredths > targetHundredths ? demandHundredths : targetHundredths),
  }
}

export type RecapLine = { productId: string; groupCode: 'AYAM' | 'TAHU' | 'NONE'; demand: string; proposed: string }

export function validateRecapAllocation(
  targets: Record<'AYAM' | 'TAHU', string>,
  lines: readonly RecapLine[],
): void {
  const sums = { AYAM: 0n, TAHU: 0n }
  const demands = { AYAM: 0n, TAHU: 0n }
  const ids = new Set<string>()
  for (const line of lines) {
    if (ids.has(line.productId)) throw new Error('DUPLICATE_PRODUCT')
    ids.add(line.productId)
    const demand = parseScaled(line.demand, 2, 8)
    const proposed = parseScaled(line.proposed, 2, 8)
    if (proposed < demand) throw new Error('BELOW_PRODUCT_DEMAND')
    if (line.groupCode === 'NONE') {
      if (proposed !== demand) throw new Error('UNTARGETED_PURCHASE_MUST_EQUAL_DEMAND')
    } else {
      sums[line.groupCode] += proposed
      demands[line.groupCode] += demand
    }
  }
  for (const group of ['AYAM', 'TAHU'] as const) {
    const target = parseScaled(targets[group], 2, 8)
    const required = target > demands[group] ? target : demands[group]
    if (sums[group] !== required) throw new Error('GROUP_TOTAL_MISMATCH')
  }
}
