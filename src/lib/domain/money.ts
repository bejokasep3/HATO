const MONEY_CENTS_MAX = 999999999999n
export function parseScaled(value: string, scale: 0 | 2, maxIntegerDigits: number, allowZero = true): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('INVALID_DECIMAL')
  const [integerPart, fractionPart = ''] = value.split('.')
  if (integerPart.replace(/^0+/, '').length > maxIntegerDigits) throw new Error('DECIMAL_OVERFLOW')
  if (scale === 0 && fractionPart && Number(fractionPart) !== 0) throw new Error('FRACTION_NOT_ALLOWED')
  const parsed = BigInt(integerPart) * 100n + BigInt(fractionPart.padEnd(2, '0'))
  if (!allowZero && parsed === 0n) throw new Error('ZERO_NOT_ALLOWED')
  return parsed
}

export function formatScaled(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

export function normalizeIndonesianDecimal(input: string): string {
  const trimmed = input.trim()
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(trimmed)) throw new Error('INVALID_DECIMAL_INPUT')
  return formatScaled(parseScaled(trimmed.replace(',', '.'), 2, 10))
}

export function lineSubtotal(unitPrice: string, quantity: string): string {
  const cents = parseScaled(unitPrice, 2, 10, false)
  const hundredths = parseScaled(quantity, 2, 8, false)
  const roundedCents = (cents * hundredths + 50n) / 100n
  if (roundedCents > MONEY_CENTS_MAX) throw new Error('MONEY_OVERFLOW')
  return formatScaled(roundedCents)
}

export function sumMoney(amounts: readonly string[]): string {
  const total = amounts.reduce((sum, amount) => sum + parseScaled(amount, 2, 10), 0n)
  if (total > MONEY_CENTS_MAX) throw new Error('MONEY_OVERFLOW')
  return formatScaled(total)
}
