export function isAllowedRequestOrigin(origin: string | null, appUrl: string | undefined, additionalOrigins = ''): boolean {
  if (!origin) return false
  const allowed = [appUrl, ...additionalOrigins.split(',')].flatMap((value) => {
    if (!value?.trim()) return []
    try {
      const url = new URL(value.trim())
      return ['https:', 'http:'].includes(url.protocol) ? [url.origin] : []
    } catch { return [] }
  })
  return allowed.includes(origin)
}
