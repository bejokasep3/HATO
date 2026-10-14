import { type PrismaClient } from '@prisma/client'
import { cycleTiming } from '../domain/calendar'
import { lineSubtotal, parseScaled, formatScaled, sumMoney } from '../domain/money'
import { paymentSummary } from '../domain/payments'
import { targetProgress } from '../domain/targets'
import { ServiceError } from './mutation'
import { getLegacyDashboardSummary } from './legacy-dashboard'

export async function getCycleSummary(prisma: PrismaClient, cycleId: string, now = new Date()) {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      targets: true,
      weeklyPrices: true,
      supplierRecap: { select: { id: true, confirmedAt: true } },
      goodsReceipt: { include: { items: true } },
      rotationSchedules: { include: { member: { include: { group: true } } } },
      orders: {
        where: { cancelledAt: null },
        include: { items: true, payments: true, member: { include: { group: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!cycle) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')

  const orderValue = sumMoney(cycle.orders.map((order) => order.totalAmount.toFixed(2)))
  const financialOrders = cycle.orders.map((order) => ({
    order,
    summary: paymentSummary(order.totalAmount.toFixed(2), order.payments.map((payment) => ({ amount: payment.amount.toFixed(2), reversed: Boolean(payment.reversedAt) })), Boolean(order.ledgerReconciledAt)),
  }))
  const verified = financialOrders.filter((entry) => entry.summary.status !== 'unverified')
  const unknownBalanceCount = financialOrders.length - verified.length
  const receivedPayments = sumMoney(verified.map((entry) => entry.summary.paidAmount!))
  const knownOutstanding = sumMoney(verified.map((entry) => entry.summary.outstandingAmount!))
  const receivedLines = cycle.goodsReceipt?.status === 'confirmed'
    ? cycle.goodsReceipt.items.filter((item) => item.receivedQty.greaterThan(0))
    : null
  const purchaseValue = receivedLines && receivedLines.every((item) => item.purchasePrice.greaterThan(0))
    ? sumMoney(receivedLines.map((item) => lineSubtotal(item.purchasePrice.toFixed(2), item.receivedQty.toFixed(2))))
    : null

  const groups = (['AYAM', 'TAHU'] as const).map((groupCode) => {
    const target = cycle.targets.find((item) => item.groupCode === groupCode)
    if (!target || cycle.rulesVersion !== 2) {
      return { groupCode, unit: groupCode === 'AYAM' ? 'kg' : 'bungkus', target: target?.quantity.toFixed(2) ?? null, demand: null, progress: null, status: 'unknown' as const }
    }
    const ids = new Set(cycle.weeklyPrices.filter((price) => price.targetGroupSnapshot === groupCode).map((price) => price.productId))
    const demand = formatScaled(cycle.orders.flatMap((order) => order.items)
      .filter((item) => ids.has(item.productId))
      .reduce((sum, item) => sum + parseScaled(item.quantity.toFixed(2), 2, 8), 0n))
    const targetAmount = target.quantity.toFixed(2)
    return {
      groupCode, unit: target.unit, target: targetAmount, demand,
      progress: targetProgress(targetAmount, demand), status: 'known' as const,
    }
  })

  const orderedMemberIds = new Set(cycle.orders.map((order) => order.memberId))
  const rotationMembers = cycle.rotationSchedules.map((schedule) => ({
    id: schedule.memberId, scheduleId: schedule.id, name: schedule.member.name,
    groupName: schedule.member.group?.name ?? '-',
    role: schedule.member.role,
    isOrdered: orderedMemberIds.has(schedule.memberId),
  })).sort((a, b) => Number(a.isOrdered) - Number(b.isOrdered) || a.name.localeCompare(b.name))
  const pendingMembers = rotationMembers.filter((member) => !member.isOrdered)

  return {
    cycle: {
      ...cycleTiming({ periodStart: cycle.periodStart.toISOString(), periodEnd: cycle.periodEnd?.toISOString(), periodState: cycle.periodState, status: cycle.status }, now),
      id: cycle.id, label: cycle.label, periodStart: cycle.periodStart.toISOString().slice(0, 10),
      periodEnd: cycle.periodEnd?.toISOString().slice(0, 10) ?? null,
      supplierDeadline: cycle.supplierDeadline?.toISOString().slice(0, 10) ?? null,
      deliveryDate: cycle.deliveryDate.toISOString().slice(0, 10),
      periodState: cycle.periodState, status: cycle.status, version: cycle.version,
      rulesVersion: cycle.rulesVersion, notes: cycle.notes,
      recapConfirmedAt: cycle.supplierRecap?.confirmedAt.toISOString() ?? null,
      receiptStatus: cycle.goodsReceipt?.status ?? 'none',
    },
    targets: groups,
    rotation: {
      scheduledCount: rotationMembers.length,
      orderedCount: rotationMembers.length - pendingMembers.length,
      pendingMembers, members: rotationMembers,
    },
    finances: {
      orderCount: cycle.orders.length,
      orderValue,
      receivedPayments,
      knownOutstanding,
      unknownBalanceCount,
      totalIncomplete: unknownBalanceCount > 0,
      purchaseValue,
    },
    recentOrders: financialOrders.slice(0, 5).map(({ order, summary }) => ({
      id: order.id, memberName: order.member.name, groupName: order.member.group?.name ?? '-',
      totalAmount: order.totalAmount.toFixed(2), paymentSummary: summary,
      orderStatus: order.orderStatus, createdAt: order.createdAt.toISOString(), itemCount: order.items.length,
    })),
  }
}

export async function getDashboardSummary(prisma: PrismaClient, cycleId?: string | null, now = new Date()) {
  const [schema] = await prisma.$queryRaw<{ operational: boolean }[]>`
    SELECT
      to_regclass('public.payments') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cycles' AND column_name = 'period_end'
      ) AS operational
  `
  if (!schema?.operational) return getLegacyDashboardSummary(prisma, cycleId, now)

  const [cycles, totalMembers] = await Promise.all([
    prisma.cycle.findMany({ orderBy: { periodStart: 'desc' }, select: {
      id: true, label: true, periodStart: true, periodEnd: true, periodState: true,
      supplierDeadline: true, deliveryDate: true, status: true, rulesVersion: true,
    } }),
    prisma.member.count({ where: { isActive: true } }),
  ])
  const selected = cycleId
    ? cycles.find((cycle) => cycle.id === cycleId)
    : cycles.find((cycle) => cycleTiming({ periodStart: cycle.periodStart.toISOString(), periodEnd: cycle.periodEnd?.toISOString() }, now).calendarStatus === 'current')
  if (cycleId && !selected) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')
  const allCycles = cycles.map((cycle) => ({
    ...cycleTiming({ periodStart: cycle.periodStart.toISOString(), periodEnd: cycle.periodEnd?.toISOString(), periodState: cycle.periodState, status: cycle.status }, now),
    id: cycle.id, label: cycle.label, periodStart: cycle.periodStart.toISOString().slice(0, 10),
    periodEnd: cycle.periodEnd?.toISOString().slice(0, 10) ?? null,
    supplierDeadline: cycle.supplierDeadline?.toISOString().slice(0, 10) ?? null,
    deliveryDate: cycle.deliveryDate.toISOString().slice(0, 10),
    periodState: cycle.periodState, status: cycle.status, rulesVersion: cycle.rulesVersion,
  }))
  if (!selected) return { evaluatedAt: now.toISOString(), hasCycle: false, allCycles, currentCycle: null, targets: [], rotation: null, finances: null, recentOrders: [], totalMembers }
  const summary = await getCycleSummary(prisma, selected.id, now)
  return { evaluatedAt: now.toISOString(), hasCycle: true, allCycles, currentCycle: summary.cycle, targets: summary.targets, rotation: summary.rotation, finances: summary.finances, recentOrders: summary.recentOrders, totalMembers }
}
