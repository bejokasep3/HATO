import { Prisma, type PrismaClient } from '@prisma/client'
import { assertPaymentAllowed, paymentSummary } from '../domain/payments'
import { formatScaled, parseScaled } from '../domain/money'
import { ServiceError, runIdempotent, type Tx } from './mutation'

async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
  if (!rows.length) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, cycle: { select: { periodState: true, rulesVersion: true } } } })
  if (order.cycle.rulesVersion === 2 && order.cycle.periodState === 'draft') throw new ServiceError(409, 'PRICES_NOT_READY', 'Isi dan kunci harga sebelum mencatat pembayaran')
  if (!order.ledgerReconciledAt) throw new ServiceError(409, 'LEDGER_RECONCILIATION_REQUIRED', 'Saldo pesanan lama belum diverifikasi')
  return order
}

function summary(order: { totalAmount: { toFixed: (digits: number) => string }; ledgerReconciledAt: Date | null; payments: { amount: { toFixed: (digits: number) => string }; reversedAt: Date | null }[] }) {
  return paymentSummary(order.totalAmount.toFixed(2), order.payments.map((payment) => ({ amount: payment.amount.toFixed(2), reversed: Boolean(payment.reversedAt) })), Boolean(order.ledgerReconciledAt))
}

export async function getOrderPayments(prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { orderBy: { createdAt: 'asc' } },
      member: { include: { group: true } },
      cycle: { select: { id: true, label: true, periodState: true, rulesVersion: true } },
    },
  })
  if (!order) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
  return {
    orderId,
    canConfirmOpeningBalance: !order.ledgerReconciledAt && order.cycle.rulesVersion !== 2 && !order.cancelledAt && order.payments.length === 0,
    pricingPending: order.cycle.rulesVersion === 2 && order.cycle.periodState === 'draft',
    orderStatus: order.orderStatus,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    version: order.version,
    member: {
      id: order.member.id,
      name: order.member.name,
      groupName: order.member.group?.name ?? null,
    },
    cycle: order.cycle,
    totalAmount: order.totalAmount.toFixed(2),
    summary: summary(order),
    payments: order.payments.map((payment) => ({
      id: payment.id, amount: payment.amount.toFixed(2), method: payment.method,
      source: payment.source, note: payment.note,
      occurredAt: payment.occurredAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      reversedAt: payment.reversedAt?.toISOString() ?? null,
      reversalReason: payment.reversalReason,
    })),
  }
}

export async function confirmOpeningBalance(prisma: PrismaClient, input: {
  actorId: string; key: string; orderId: string; expectedVersion: number; paidAmount: string; reason: string; requireFull?: boolean
}) {
  let paid: bigint
  try { paid = parseScaled(input.paidAmount, 2, 10) }
  catch { throw new ServiceError(400, 'INVALID_OPENING_AMOUNT', 'Nominal yang sudah dibayar tidak valid') }
  if (!input.reason.trim()) throw new ServiceError(400, 'REASON_REQUIRED', 'Catatan pemeriksaan wajib diisi')
  const paidAmount = formatScaled(paid)
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'payment.confirm_opening_balance', key: input.key,
    payload: { orderId: input.orderId, expectedVersion: input.expectedVersion, paidAmount, reason: input.reason.trim() },
  }, async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${input.orderId}::uuid FOR UPDATE`
    if (!rows.length) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { payments: true, cycle: true } })
    if (order.version !== input.expectedVersion) throw new ServiceError(409, 'STALE_VERSION', 'Saldo telah berubah; muat ulang sebelum konfirmasi')
    if (order.ledgerReconciledAt) throw new ServiceError(409, 'BALANCE_ALREADY_CONFIRMED', 'Saldo awal sudah dikonfirmasi')
    if (order.cycle.rulesVersion === 2) throw new ServiceError(409, 'NOT_LEGACY_ORDER', 'Pesanan minggu baru harus dihitung melalui penguncian harga')
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pesanan dibatalkan')
    if (order.payments.length) throw new ServiceError(409, 'EXISTING_LEDGER_ENTRIES', 'Pesanan sudah memiliki catatan pembayaran; periksa catatan sebelum mengonfirmasi saldo')
    const total = order.totalAmount.toFixed(2)
    if (input.requireFull && paid !== 0n && paid !== parseScaled(total, 2, 10)) throw new ServiceError(400, 'FULL_PAYMENT_REQUIRED', 'Pilih belum dibayar atau lunas penuh')
    if (paid > parseScaled(total, 2, 10)) throw new ServiceError(409, 'OPENING_EXCEEDS_TOTAL', 'Jumlah yang sudah dibayar melebihi nilai pesanan')
    const now = new Date()
    if (paid > 0n) await tx.payment.create({ data: {
      orderId: order.id, amount: paidAmount, method: 'other', source: 'legacy_opening_balance',
      legacySourceOrderId: order.id, actorId: input.actorId, note: input.reason.trim(), occurredAt: null,
    } })
    const balance = paymentSummary(total, paid > 0n ? [{ amount: paidAmount, reversed: false }] : [], true)
    const updated = await tx.order.update({ where: { id: order.id }, data: {
      ledgerReconciledAt: now, ledgerReconciledBy: input.actorId, version: { increment: 1 },
      paymentStatus: balance.status, paidAt: balance.status === 'paid' ? order.paidAt : null,
    } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'order', entityId: order.id, action: 'opening_balance_confirmed',
      before: { paymentStatus: order.paymentStatus, totalAmount: total, ledgerReconciled: false },
      after: { paidAmount, outstandingAmount: balance.outstandingAmount, ledgerReconciled: true }, reason: input.reason.trim(),
    } })
    return { status: 200, body: { orderId: order.id, orderVersion: updated.version, summary: balance } }
  })
}

export async function addPayment(prisma: PrismaClient, input: {
  actorId: string; key: string; orderId: string; amount: string
  method: 'cash' | 'transfer' | 'other'; occurredAt?: string; note?: string | null; requireFull?: boolean
}) {
  try { parseScaled(input.amount, 2, 10, false) }
  catch { throw new ServiceError(400, 'INVALID_PAYMENT_AMOUNT', 'Nominal pembayaran tidak valid') }
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()
  if (Number.isNaN(occurredAt.valueOf())) throw new ServiceError(400, 'INVALID_PAYMENT_DATE', 'Waktu pembayaran tidak valid')
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'payment.add', key: input.key,
    payload: { orderId: input.orderId, amount: input.amount, method: input.method, occurredAt: input.occurredAt ?? null, note: input.note ?? null },
  }, async (tx) => {
    const order = await lockOrder(tx, input.orderId)
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pesanan dibatalkan')
    const before = summary(order)
    if (before.status === 'unverified') throw new ServiceError(409, 'LEDGER_RECONCILIATION_REQUIRED', 'Saldo belum diverifikasi')
    if (input.requireFull && parseScaled(input.amount, 2, 10) !== parseScaled(before.outstandingAmount, 2, 10)) throw new ServiceError(400, 'FULL_PAYMENT_REQUIRED', 'Pembayaran harus melunasi seluruh pesanan')
    try { assertPaymentAllowed(before.outstandingAmount, input.amount) }
    catch { throw new ServiceError(409, 'PAYMENT_EXCEEDS_OUTSTANDING', 'Nominal melebihi sisa tagihan', { outstanding: before.outstandingAmount }) }
    const payment = await tx.payment.create({ data: {
      orderId: input.orderId, amount: input.amount, method: input.method,
      note: input.note ?? null, occurredAt, source: 'manual', actorId: input.actorId,
    } })
    const after = paymentSummary(order.totalAmount.toFixed(2), [...order.payments.map((entry) => ({ amount: entry.amount.toFixed(2), reversed: Boolean(entry.reversedAt) })), { amount: input.amount, reversed: false }], true)
    const updated = await tx.order.update({ where: { id: input.orderId }, data: {
      paymentStatus: after.status,
      paidAt: after.status === 'paid' ? occurredAt : null,
      version: { increment: 1 },
    } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'payment', entityId: payment.id, action: 'recorded',
      after: { orderId: input.orderId, amount: input.amount, method: input.method },
    } })
    return { status: 201, body: {
      id: payment.id, orderId: input.orderId, amount: payment.amount.toFixed(2),
      method: payment.method, occurredAt: occurredAt.toISOString(),
      orderVersion: updated.version, summary: after,
    } }
  })
}

export async function settleOrder(prisma: PrismaClient, input: {
  actorId: string; key: string; orderId: string; expectedVersion: number
}) {
  return runIdempotent(prisma, { actorId: input.actorId, key: input.key, operation: 'payment.settle', payload: { orderId: input.orderId, expectedVersion: input.expectedVersion } }, async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${input.orderId}::uuid FOR UPDATE`
    if (!rows.length) throw new ServiceError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan')
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { payments: true, cycle: true } })
    if (order.version !== input.expectedVersion) throw new ServiceError(409, 'STALE_VERSION', 'Pesanan berubah; muat ulang sebelum menandai lunas')
    if (order.cancelledAt) throw new ServiceError(409, 'ORDER_CANCELLED', 'Pesanan sudah dihapus')
    if (order.cycle.rulesVersion === 2 && order.cycle.periodState === 'draft') throw new ServiceError(409, 'PRICES_NOT_READY', 'Isi dan kunci harga terlebih dahulu')
    if (!order.ledgerReconciledAt && order.payments.length) throw new ServiceError(409, 'EXISTING_LEDGER_ENTRIES', 'Periksa catatan pembayaran lama terlebih dahulu')
    const paid = sumEffectivePayments(order.payments)
    const remaining = parseScaled(order.totalAmount.toFixed(2), 2, 10) - parseScaled(paid, 2, 10)
    if (remaining < 0n) throw new ServiceError(409, 'BALANCE_INVALID', 'Pembayaran melebihi nilai pesanan; periksa catatan pembayaran')
    const now = new Date()
    const historical = !order.ledgerReconciledAt && order.cycle.rulesVersion !== 2
    if (remaining > 0n) await tx.payment.create({ data: {
      orderId: order.id, amount: formatScaled(remaining), method: 'other', actorId: input.actorId,
      source: historical ? 'legacy_opening_balance' : 'manual', legacySourceOrderId: historical ? order.id : null,
      occurredAt: historical ? null : now, note: historical ? 'Dikonfirmasi lunas dari daftar pesanan' : 'Pembayaran penuh dari daftar pesanan',
    } })
    const updated = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid', ledgerReconciledAt: order.ledgerReconciledAt ?? now, ledgerReconciledBy: order.ledgerReconciledBy ?? input.actorId, paidAt: historical ? order.paidAt : order.paidAt ?? now, version: { increment: 1 } } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'order', entityId: order.id, action: 'settled', before: { paidAmount: paid }, after: { paidAmount: order.totalAmount.toFixed(2), paymentStatus: 'paid' } } })
    return { status: 200, body: { orderId: order.id, orderVersion: updated.version, status: 'paid' } }
  })
}

function sumEffectivePayments(payments: { amount: { toFixed: (digits: number) => string }; reversedAt: Date | null }[]) {
  return formatScaled(payments.filter((entry) => !entry.reversedAt).reduce((total, entry) => total + parseScaled(entry.amount.toFixed(2), 2, 10), 0n))
}

export async function reversePayment(prisma: PrismaClient, input: {
  actorId: string; key: string; paymentId: string; reason: string
}) {
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'payment.reverse', key: input.key,
    payload: { paymentId: input.paymentId, reason: input.reason },
  }, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } })
    if (!payment) throw new ServiceError(404, 'PAYMENT_NOT_FOUND', 'Pembayaran tidak ditemukan')
    const order = await lockOrder(tx, payment.orderId)
    const current = order.payments.find((entry) => entry.id === input.paymentId)
    if (!current) throw new ServiceError(404, 'PAYMENT_NOT_FOUND', 'Pembayaran tidak ditemukan')
    if (current.reversedAt) throw new ServiceError(409, 'PAYMENT_ALREADY_REVERSED', 'Pembayaran sudah dibalik')
    const reversedAt = new Date()
    await tx.payment.update({ where: { id: input.paymentId }, data: { reversedAt, reversedBy: input.actorId, reversalReason: input.reason } })
    const after = paymentSummary(order.totalAmount.toFixed(2), order.payments.map((entry) => ({ amount: entry.amount.toFixed(2), reversed: entry.id === input.paymentId || Boolean(entry.reversedAt) })), true)
    const updated = await tx.order.update({ where: { id: payment.orderId }, data: {
      paymentStatus: after.status, paidAt: after.status === 'paid' ? order.paidAt : null,
      version: { increment: 1 },
    } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'payment', entityId: input.paymentId, action: 'reversed',
      reason: input.reason, before: { amount: current.amount.toFixed(2), orderId: payment.orderId },
      after: { reversedAt: reversedAt.toISOString() },
    } })
    return { status: 200, body: { id: input.paymentId, orderId: payment.orderId, reversedAt: reversedAt.toISOString(), orderVersion: updated.version, summary: after } }
  })
}

export async function getReceivables(prisma: PrismaClient, input: {
  page: number; pageSize: number; cycleId?: string | null; groupId?: string | null
}) {
  const offset = (input.page - 1) * input.pageSize
  const cycleId = input.cycleId ?? null
  const groupId = input.groupId ?? null
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{
      id: string; cycle_id: string; cycle_label: string; member_id: string; member_name: string;
      total_amount: Prisma.Decimal; paid_amount: Prisma.Decimal; outstanding_amount: Prisma.Decimal
    }[]>`
      WITH balances AS (
        SELECT o.id, o.cycle_id, o.member_id, o.total_amount, o.created_at,
               COALESCE(SUM(p.amount) FILTER (WHERE p.reversed_at IS NULL), 0) AS paid_amount
        FROM orders o LEFT JOIN payments p ON p.order_id = o.id
        JOIN members m ON m.id = o.member_id
        WHERE o.cancelled_at IS NULL AND o.ledger_reconciled_at IS NOT NULL
          AND (${cycleId}::uuid IS NULL OR o.cycle_id = ${cycleId}::uuid)
          AND (${groupId}::uuid IS NULL OR m.group_id = ${groupId}::uuid)
        GROUP BY o.id
      )
      SELECT b.id, b.cycle_id, c.label AS cycle_label, b.member_id, m.name AS member_name,
             b.total_amount, b.paid_amount, b.total_amount - b.paid_amount AS outstanding_amount
      FROM balances b JOIN cycles c ON c.id = b.cycle_id JOIN members m ON m.id = b.member_id
      WHERE b.total_amount > b.paid_amount
      ORDER BY b.created_at DESC, b.id DESC LIMIT ${input.pageSize} OFFSET ${offset}
    `
    const [totals] = await tx.$queryRaw<{ count: bigint; outstanding_total: Prisma.Decimal }[]>`
      WITH balances AS (
        SELECT o.id, o.total_amount,
               COALESCE(SUM(p.amount) FILTER (WHERE p.reversed_at IS NULL), 0) AS paid_amount
        FROM orders o LEFT JOIN payments p ON p.order_id = o.id
        JOIN members m ON m.id = o.member_id
        WHERE o.cancelled_at IS NULL AND o.ledger_reconciled_at IS NOT NULL
          AND (${cycleId}::uuid IS NULL OR o.cycle_id = ${cycleId}::uuid)
          AND (${groupId}::uuid IS NULL OR m.group_id = ${groupId}::uuid)
        GROUP BY o.id
      )
      SELECT COUNT(*) AS count, COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE total_amount > paid_amount), 0) AS outstanding_total
      FROM balances WHERE total_amount > paid_amount
    `
    const unknownCount = await tx.order.count({ where: {
      cancelledAt: null, ledgerReconciledAt: null,
      ...(cycleId ? { cycleId } : {}),
      ...(groupId ? { member: { groupId } } : {}),
    } })
    return {
      page: input.page, pageSize: input.pageSize,
      totalCount: Number(totals.count),
      totalKnownOutstanding: totals.outstanding_total.toFixed(2),
      unreconciledOrderCount: unknownCount,
      totalIncomplete: unknownCount > 0,
      items: rows.map((row) => ({
        orderId: row.id, cycleId: row.cycle_id, cycleLabel: row.cycle_label,
        memberId: row.member_id, memberName: row.member_name,
        totalAmount: row.total_amount.toFixed(2), paidAmount: row.paid_amount.toFixed(2),
        outstandingAmount: row.outstanding_amount.toFixed(2),
      })),
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
