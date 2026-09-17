export function formatCurrency(amount: number | string | { toString(): string }): string {
  const num = typeof amount === 'number' ? amount : Number(amount)
  if (isNaN(num)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(d)
}

export function getWhatsAppUrl(phone: string, message?: string): string {
  let cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1)
  }
  const encodedMsg = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${cleanPhone}${encodedMsg ? `?text=${encodedMsg}` : ''}`
}

export function getStatusColor(status: string): { bg: string, text: string } {
  const s = status?.toLowerCase() || '';
  if (s === 'open' || s === 'paid') return { bg: '#ecfdf5', text: '#047857' }; // emerald
  if (s === 'draft' || s === 'pending') return { bg: '#fffbeb', text: '#b45309' }; // amber
  if (s === 'unpaid') return { bg: '#fff1f2', text: '#be123c' }; // rose
  return { bg: '#f1f5f9', text: '#334155' }; // slate
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Buka',
    draft: 'Draft',
    closed: 'Tutup',
    delivered: 'Dikirim',
    completed: 'Selesai',
    paid: 'Lunas',
    unpaid: 'Belum Bayar',
    pending: 'Menunggu',
  };
  return labels[status?.toLowerCase()] || status;
}
