import { type PrismaClient } from '@prisma/client'
import { addCalendarDays, businessDate, cycleTiming } from '../domain/calendar'
import { lineSubtotal, sumMoney } from '../domain/money'
import { targetProgress } from '../domain/targets'
import { ServiceError } from './mutation'

type CycleRow = {
  id: string
  label: string
  period_start: Date
  order_deadline: Date
  delivery_date: Date
  status: string
  notes: string | null
}

type TargetRow = {
  name: string
  unit: string
  target_quantity: { toFixed(digits: number): string } | null
}

type OrderItemRow = {
  product_name: string
  quantity: { toFixed(digits: number): string }
}

type OrderRow = {
  id: string
  member_id: string
  member_name: string
  group_name: string | null
  total_amount: { toFixed(digits: number): string }
  payment_status: string
  order_status: string
  created_at: Date
  item_count: number
}

type RotationRow = {
  schedule_id: string
  member_id: string
  member_name: string
  group_name: string | null
  role: string
}

type ReceiptRow = {
  status: string
  received_qty: { toFixed(digits: number): string } | null
  purchase_price: { toFixed(digits: number): string } | null
}

function dateText(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function periodState(status: string): 'draft' | 'open' | 'closed' {
  if (status === 'open') return 'open'
  if (['closed', 'delivered', 'completed'].includes(status)) return 'closed'
  return 'draft'
}

function targetGroup(name: string): 'AYAM' | 'TAHU' | null {
  const normalized = name.toLocaleLowerCase('id-ID')
  if (normalized.includes('karkas') || normalized.includes('recah') || normalized.includes('gebrus')) return 'AYAM'
  if (normalized.includes('tahu')) return 'TAHU'
  return null
}

function sumQuantities(values: readonly string[]): string {
  const total = values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0)
  return (total / 100).toFixed(2)
}

export async function getLegacyDashboardSummary(prisma: PrismaClient, cycleId?: string | null, now = new Date()) {
  const [cycles, memberCounts] = await Promise.all([
    prisma.$queryRaw<CycleRow[]>`
      SELECT id, label, period_start, order_deadline, delivery_date, status, notes
      FROM public.cycles
      ORDER BY period_start DESC
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM public.members WHERE is_active = true
    `,
  ])

  const today = businessDate(now)
  const selected = cycleId
    ? cycles.find((cycle) => cycle.id === cycleId)
    : cycles.find((cycle) => dateText(cycle.period_start) <= today && addCalendarDays(dateText(cycle.period_start), 6) >= today)

  if (cycleId && !selected) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')

  const allCycles = cycles.map((cycle) => {
    const start = dateText(cycle.period_start)
    return {
      ...cycleTiming({ periodStart: start, periodState: periodState(cycle.status) }, now),
      id: cycle.id,
      label: cycle.label,
      periodStart: start,
      periodEnd: addCalendarDays(start, 6),
      supplierDeadline: addCalendarDays(start, 1),
      deliveryDate: dateText(cycle.delivery_date),
      periodState: periodState(cycle.status),
      status: cycle.status,
      rulesVersion: 1,
    }
  })

  const totalMembers = Number(memberCounts[0]?.total ?? 0n)
  if (!selected) {
    return { evaluatedAt: now.toISOString(), hasCycle: false, allCycles, currentCycle: null, targets: [], orderedMembers: [], rotation: null, finances: null, recentOrders: [], totalMembers }
  }

  const [targetRows, itemRows, orders, rotationRows, receiptRows] = await Promise.all([
    prisma.$queryRaw<TargetRow[]>`
      SELECT name, unit, target_quantity
      FROM public.products
      WHERE is_active = true AND is_target = true
      ORDER BY sort_order, name
    `,
    prisma.$queryRaw<OrderItemRow[]>`
      SELECT p.name AS product_name, oi.quantity
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.cycle_id = ${selected.id}::uuid
    `,
    prisma.$queryRaw<OrderRow[]>`
      SELECT o.id, o.member_id, m.name AS member_name, g.name AS group_name,
             o.total_amount, o.payment_status, o.order_status, o.created_at,
             COUNT(oi.id)::int AS item_count
      FROM public.orders o
      JOIN public.members m ON m.id = o.member_id
      LEFT JOIN public.groups g ON g.id = m.group_id
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.cycle_id = ${selected.id}::uuid
      GROUP BY o.id, o.member_id, m.name, g.name, o.total_amount,
               o.payment_status, o.order_status, o.created_at
      ORDER BY o.created_at DESC
    `,
    prisma.$queryRaw<RotationRow[]>`
      SELECT r.id AS schedule_id, r.member_id, m.name AS member_name,
             g.name AS group_name, m.role
      FROM public.rotation_schedules r
      JOIN public.members m ON m.id = r.member_id
      LEFT JOIN public.groups g ON g.id = m.group_id
      WHERE r.cycle_id = ${selected.id}::uuid
    `,
    prisma.$queryRaw<ReceiptRow[]>`
      SELECT gr.status, gri.received_qty, gri.purchase_price
      FROM public.goods_receipts gr
      LEFT JOIN public.goods_receipt_items gri ON gri.goods_receipt_id = gr.id
      WHERE gr.cycle_id = ${selected.id}::uuid
    `,
  ])

  const targets = (['AYAM', 'TAHU'] as const).map((groupCode) => {
    const matchingTargets = targetRows.filter((row) => targetGroup(row.name) === groupCode && row.target_quantity)
    const target = matchingTargets[0]?.target_quantity?.toFixed(2) ?? null
    const demand = sumQuantities(itemRows
      .filter((row) => targetGroup(row.product_name) === groupCode)
      .map((row) => row.quantity.toFixed(2)))
    const unit = groupCode === 'AYAM' ? 'kg' : 'bungkus'
    return target === null
      ? { groupCode, unit, target: null, demand: null, progress: null, status: 'unknown' as const }
      : { groupCode, unit, target, demand, progress: targetProgress(target, demand), status: 'known' as const }
  })

  const orderedMemberIds = new Set(orders.map((order) => order.member_id))
  const members = rotationRows.map((row) => ({
    id: row.member_id,
    scheduleId: row.schedule_id,
    name: row.member_name,
    groupName: row.group_name ?? '-',
    role: row.role,
    isOrdered: orderedMemberIds.has(row.member_id),
  })).sort((a, b) => Number(a.isOrdered) - Number(b.isOrdered) || a.name.localeCompare(b.name))

  const orderValue = sumMoney(orders.map((order) => order.total_amount.toFixed(2)))
  const receivedPayments = sumMoney(orders
    .filter((order) => order.payment_status === 'paid')
    .map((order) => order.total_amount.toFixed(2)))
  const knownOutstanding = sumMoney(orders
    .filter((order) => order.payment_status !== 'paid')
    .map((order) => order.total_amount.toFixed(2)))
  const receivedLines = receiptRows.filter((row) => row.status === 'confirmed' && row.received_qty && Number(row.received_qty.toFixed(2)) > 0)
  const purchaseValue = receivedLines.length > 0 && receivedLines.every((row) => row.purchase_price && Number(row.purchase_price.toFixed(2)) > 0)
    ? sumMoney(receivedLines.map((row) => lineSubtotal(row.purchase_price!.toFixed(2), row.received_qty!.toFixed(2))))
    : null

  const start = dateText(selected.period_start)
  return {
    evaluatedAt: now.toISOString(),
    hasCycle: true,
    allCycles,
    currentCycle: {
      ...cycleTiming({ periodStart: start, periodState: periodState(selected.status) }, now),
      id: selected.id,
      label: selected.label,
      periodStart: start,
      periodEnd: addCalendarDays(start, 6),
      supplierDeadline: addCalendarDays(start, 1),
      deliveryDate: dateText(selected.delivery_date),
      periodState: periodState(selected.status),
      status: selected.status,
      version: 0,
      rulesVersion: 1,
      notes: selected.notes,
      recapConfirmedAt: null,
      receiptStatus: receiptRows[0]?.status ?? 'none',
    },
    targets,
    orderedMembers: [...new Map(orders.map((order) => [order.member_id, { id: order.member_id, name: order.member_name, groupName: order.group_name ?? '-', orderId: order.id }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
    rotation: {
      scheduledCount: members.length,
      orderedCount: members.filter((member) => member.isOrdered).length,
      pendingMembers: members.filter((member) => !member.isOrdered),
      members,
    },
    finances: {
      orderCount: orders.length,
      orderValue,
      receivedPayments,
      knownOutstanding,
      unknownBalanceCount: 0,
      totalIncomplete: false,
      purchaseValue,
    },
    recentOrders: orders.slice(0, 5).map((order) => {
      const amount = order.total_amount.toFixed(2)
      const paid = order.payment_status === 'paid'
      return {
        id: order.id,
        memberName: order.member_name,
        groupName: order.group_name ?? '-',
        totalAmount: amount,
        paymentSummary: {
          status: paid ? 'paid' as const : 'unpaid' as const,
          paidAmount: paid ? amount : '0.00',
          outstandingAmount: paid ? '0.00' : amount,
        },
        orderStatus: order.order_status,
        createdAt: order.created_at.toISOString(),
        itemCount: order.item_count,
      }
    }),
    totalMembers,
  }
}
