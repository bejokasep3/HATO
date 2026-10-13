export function reportNumber(value: number | null | undefined): number | string {
  return value == null ? 'Belum diketahui' : value
}

export function reportPercent(value: number | null | undefined): string {
  return value == null ? 'Belum diketahui' : `${value}%`
}

export function reportCurrency(value: number | string | null | undefined): string {
  if (value == null) return 'Belum diketahui'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value))
}

export function reportCsvCell(value: unknown): string {
  const text = value == null ? 'Belum diketahui' : String(value)
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}
