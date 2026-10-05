import { type PrismaClient } from '@prisma/client'
import { addCalendarDays } from '../domain/calendar'
import { getLegacyDashboardSummary } from './legacy-dashboard'

const decimal = (value: { toFixed(digits: number): string } | null | undefined) => value?.toFixed(2) ?? '0.00'
const number = (value: { toFixed(digits: number): string } | null | undefined) => Number(decimal(value))
const iso = (value: Date) => value.toISOString()
const date = (value: Date) => value.toISOString().slice(0, 10)
const phase = (status: string): 'draft' | 'open' | 'closed' => status === 'open' ? 'open' : ['closed', 'delivered', 'completed'].includes(status) ? 'closed' : 'draft'

function groupCode(name: string): 'AYAM' | 'TAHU' | null {
  const value = name.toLocaleLowerCase('id-ID')
  if (value.includes('karkas') || value.includes('recah') || value.includes('gebrus')) return 'AYAM'
  if (value.includes('tahu')) return 'TAHU'
  return null
}

export async function getLegacyCycles(prisma: PrismaClient) {
  const [cycles, targets] = await Promise.all([
    prisma.cycle.findMany({
      select: {
        id: true, label: true, periodStart: true, orderDeadline: true, deliveryDate: true,
        status: true, notes: true,
        rotationSchedules: { select: { id: true } },
        orders: { select: { totalAmount: true, paymentStatus: true } },
      },
      orderBy: { periodStart: 'desc' },
    }),
    prisma.product.findMany({
      where: { isActive: true, isTarget: true },
      select: { name: true, unit: true, targetQuantity: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])
  return cycles.map((cycle) => {
    const orderValue = cycle.orders.reduce((sum, order) => sum + number(order.totalAmount), 0)
    const paidAmount = cycle.orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + number(order.totalAmount), 0)
    const start = date(cycle.periodStart)
    const cycleTargets = (['AYAM', 'TAHU'] as const).flatMap((code) => {
      const target = targets.find((item) => groupCode(item.name) === code)
      return target?.targetQuantity ? [{ groupCode: code, quantity: decimal(target.targetQuantity), unit: code === 'AYAM' ? 'kg' : 'bungkus' }] : []
    })
    return {
      id: cycle.id, label: cycle.label, periodStart: start, orderDeadline: date(cycle.orderDeadline),
      periodEnd: addCalendarDays(start, 6), supplierDeadline: addCalendarDays(start, 1),
      deliveryDate: date(cycle.deliveryDate), periodState: phase(cycle.status), status: cycle.status,
      notes: cycle.notes, totalOrders: cycle.orders.length, totalRotation: cycle.rotationSchedules.length,
      totalAmount: orderValue, paidAmount, orderValue: orderValue.toFixed(2), receivedPayments: paidAmount.toFixed(2),
      knownOutstanding: (orderValue - paidAmount).toFixed(2), unknownBalanceCount: 0, version: 0, targets: cycleTargets,
    }
  })
}

export async function getLegacyProducts(prisma: PrismaClient, activeOnly: boolean) {
  const currentCycle = await prisma.cycle.findFirst({
    where: { status: { in: ['open', 'draft'] } }, orderBy: { periodStart: 'desc' },
    select: { id: true, label: true },
  })
  const products = await prisma.product.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    select: {
      id: true, name: true, unit: true, isTarget: true, targetQuantity: true, category: true,
      sortOrder: true, isActive: true, _count: { select: { orderItems: true } },
      weeklyPrices: currentCycle ? {
        where: { cycleId: currentCycle.id }, take: 1,
        select: { price: true, consumerPrice: true, traderPrice: true },
      } : false,
    },
    orderBy: [{ isTarget: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
  return products.map((product) => {
    const weekly = product.weeklyPrices?.[0]
    const consumerPrice = weekly ? number(weekly.consumerPrice ?? weekly.price) : null
    const traderPrice = weekly ? number(weekly.traderPrice ?? weekly.consumerPrice ?? weekly.price) : null
    return {
      id: product.id, name: product.name, unit: product.unit, isTarget: product.isTarget,
      targetQuantity: product.targetQuantity ? number(product.targetQuantity) : null, category: product.category,
      sortOrder: product.sortOrder, isActive: product.isActive, _count: product._count,
      consumerPrice, traderPrice, currentPrice: consumerPrice,
      activeCycleId: currentCycle?.id ?? null, activeCycleLabel: currentCycle?.label ?? null,
    }
  })
}

export async function getLegacyPrices(prisma: PrismaClient, cycleId: string) {
  const prices = await prisma.weeklyPrice.findMany({
    where: { cycleId },
    select: {
      id: true, cycleId: true, productId: true, price: true, consumerPrice: true, traderPrice: true, createdAt: true,
      product: { select: { id: true, name: true, unit: true, isTarget: true, targetQuantity: true, category: true, sortOrder: true, isActive: true } },
    },
    orderBy: { product: { sortOrder: 'asc' } },
  })
  return prices.map((item) => ({
    ...item, price: number(item.price), consumerPrice: number(item.consumerPrice ?? item.price),
    traderPrice: number(item.traderPrice ?? item.consumerPrice ?? item.price),
    product: { ...item.product, targetQuantity: item.product.targetQuantity ? number(item.product.targetQuantity) : null },
  }))
}

export async function getLegacyOrders(prisma: PrismaClient, filters: { cycleId?: string | null; memberId?: string | null; orderStatus?: string | null; paymentStatus?: string | null }) {
  const orders = await prisma.order.findMany({
    where: {
      ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.orderStatus ? { orderStatus: filters.orderStatus } : {}),
    },
    select: {
      id: true, cycleId: true, memberId: true, totalAmount: true, paymentStatus: true, orderStatus: true,
      notes: true, paidAt: true, createdAt: true, updatedAt: true,
      cycle: { select: { id: true, label: true, status: true } },
      member: { select: { id: true, name: true, phone: true, role: true, group: { select: { id: true, name: true } } } },
      items: { select: {
        id: true, orderId: true, productId: true, priceType: true, quantity: true, unitPrice: true, subtotal: true, createdAt: true,
        product: { select: { id: true, name: true, unit: true, isActive: true } },
      } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const formatted = orders.map((order) => {
    const total = decimal(order.totalAmount)
    const paid = order.paymentStatus === 'paid'
    const summary = { status: paid ? 'paid' as const : 'unpaid' as const, paidAmount: paid ? total : '0.00', outstandingAmount: paid ? '0.00' : total }
    return {
      ...order, totalAmount: total, version: 0, cancelledAt: null, ledgerReconciledAt: order.updatedAt,
      paymentStatus: summary.status, paymentSummary: summary, payments: [],
      items: order.items.map((item) => ({ ...item, quantity: decimal(item.quantity), unitPrice: decimal(item.unitPrice), subtotal: decimal(item.subtotal) })),
    }
  })
  return filters.paymentStatus ? formatted.filter((order) => order.paymentSummary.status === filters.paymentStatus) : formatted
}

export async function getLegacyReceivables(prisma: PrismaClient, input: { page: number; pageSize: number; cycleId?: string | null; groupId?: string | null }) {
  const where = {
    paymentStatus: { not: 'paid' },
    ...(input.cycleId ? { cycleId: input.cycleId } : {}),
    ...(input.groupId ? { member: { groupId: input.groupId } } : {}),
  }
  const [orders, totalCount, totals] = await Promise.all([
    prisma.order.findMany({
      where, skip: (input.page - 1) * input.pageSize, take: input.pageSize,
      select: { id: true, cycleId: true, memberId: true, totalAmount: true, cycle: { select: { label: true } }, member: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.count({ where }),
    prisma.order.findMany({ where, select: { totalAmount: true } }),
  ])
  return {
    page: input.page, pageSize: input.pageSize, totalCount,
    totalKnownOutstanding: totals.reduce((sum, order) => sum + number(order.totalAmount), 0).toFixed(2),
    unreconciledOrderCount: 0, totalIncomplete: false,
    items: orders.map((order) => ({
      orderId: order.id, cycleId: order.cycleId, cycleLabel: order.cycle.label,
      memberId: order.memberId, memberName: order.member.name, totalAmount: decimal(order.totalAmount),
      paidAmount: '0.00', outstandingAmount: decimal(order.totalAmount),
    })),
  }
}

export async function getLegacyOrderPayments(prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, totalAmount: true, paymentStatus: true, paidAt: true, createdAt: true,
      member: { select: { id: true, name: true, group: { select: { name: true } } } },
      cycle: { select: { id: true, label: true } },
    },
  })
  if (!order) throw new Error('Pesanan tidak ditemukan')
  const total = decimal(order.totalAmount)
  const paid = order.paymentStatus === 'paid'
  return {
    orderId: order.id, cancelledAt: null,
    member: { id: order.member.id, name: order.member.name, groupName: order.member.group?.name ?? null },
    cycle: order.cycle, totalAmount: total,
    summary: { status: paid ? 'paid' as const : 'unpaid' as const, paidAmount: paid ? total : '0.00', outstandingAmount: paid ? '0.00' : total },
    payments: paid ? [{
      id: `legacy-${order.id}`, amount: total, method: 'other' as const, source: 'legacy_payment_status', note: 'Status pembayaran dari data lama',
      occurredAt: order.paidAt ? iso(order.paidAt) : null, createdAt: iso(order.paidAt ?? order.createdAt), reversedAt: null, reversalReason: null,
    }] : [],
  }
}

export async function getLegacyInventory(prisma: PrismaClient, cycleId?: string | null) {
  if (!cycleId) {
    const cycles = await prisma.cycle.findMany({
      select: {
        id: true, label: true, periodStart: true, status: true,
        goodsReceipt: { select: { status: true } }, _count: { select: { orders: true } },
      },
      orderBy: { periodStart: 'desc' },
    })
    return cycles.map((cycle) => ({
      cycleId: cycle.id, cycleLabel: cycle.label, periodStart: date(cycle.periodStart), periodState: phase(cycle.status),
      receiptStatus: cycle.goodsReceipt?.status ?? 'none', totalOrders: cycle._count.orders,
    }))
  }
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      orders: { select: { orderStatus: true, items: { select: { productId: true, quantity: true } } } },
      goodsReceipt: { select: {
        id: true, status: true, receivedAt: true, supplierNote: true,
        items: { select: { productId: true, orderedQty: true, receivedQty: true, damagedQty: true, purchasePrice: true, notes: true } },
      } },
    },
  })
  if (!cycle) throw new Error('Siklus tidak ditemukan')
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, unit: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  const receiptByProduct = new Map(cycle.goodsReceipt?.items.map((item) => [item.productId, item]) ?? [])
  const items = products.map((product) => {
    const allocated = cycle.orders.flatMap((order) => order.items).filter((item) => item.productId === product.id).reduce((sum, item) => sum + number(item.quantity), 0)
    const shipped = cycle.orders.filter((order) => ['shipped', 'delivered'].includes(order.orderStatus)).flatMap((order) => order.items).filter((item) => item.productId === product.id).reduce((sum, item) => sum + number(item.quantity), 0)
    const receipt = receiptByProduct.get(product.id)
    const confirmed = cycle.goodsReceipt?.status === 'confirmed' && receipt
    const received = receipt ? number(receipt.receivedQty) : 0
    const damaged = receipt ? number(receipt.damagedQty) : 0
    const capacity = receipt ? number(receipt.orderedQty) : allocated
    const usable = Math.max(0, received - damaged)
    return {
      productId: product.id, productName: product.name, unit: product.unit,
      capacity: capacity.toFixed(2), allocated: allocated.toFixed(2), shipped: shipped.toFixed(2),
      availableToOrder: confirmed ? Math.max(0, usable - allocated).toFixed(2) : null,
      shortage: confirmed ? Math.max(0, allocated - usable).toFixed(2) : null,
      physicalRemaining: confirmed ? Math.max(0, usable - shipped).toFixed(2) : null,
      reserved: confirmed ? Math.max(0, allocated - shipped).toFixed(2) : null,
      source: confirmed ? 'received' as const : 'planned' as const,
    }
  }).filter((item) => Number(item.capacity) > 0 || Number(item.allocated) > 0 || receiptByProduct.has(item.productId))
  return {
    cycleId: cycle.id, cycleVersion: 0, items,
    receipt: cycle.goodsReceipt ? {
      id: cycle.goodsReceipt.id, status: cycle.goodsReceipt.status, receivedAt: cycle.goodsReceipt.receivedAt,
      supplierNote: cycle.goodsReceipt.supplierNote, version: 0,
      confirmedAt: cycle.goodsReceipt.status === 'confirmed' ? cycle.goodsReceipt.receivedAt : null,
      items: cycle.goodsReceipt.items.map((item) => ({
        productId: item.productId, orderedQty: decimal(item.orderedQty), receivedQty: decimal(item.receivedQty),
        damagedQty: decimal(item.damagedQty), purchasePrice: decimal(item.purchasePrice), notes: item.notes,
      })),
    } : null,
  }
}

export async function getLegacyRanking(prisma: PrismaClient) {
  const [members, groups] = await Promise.all([
    prisma.member.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true, role: true, group: { select: { name: true } }, orders: { select: { totalAmount: true, paymentStatus: true } } },
    }),
    prisma.group.findMany({
      where: { level: { in: [2, 3] }, isActive: true },
      select: { id: true, name: true, level: true, members: { where: { isActive: true }, select: { orders: { select: { totalAmount: true } } } } },
    }),
  ])
  const leaderboard = members.map((member) => {
    const orderCount = member.orders.length
    const totalSpend = member.orders.reduce((sum, order) => sum + number(order.totalAmount), 0)
    const paidOrdersCount = member.orders.filter((order) => order.paymentStatus === 'paid').length
    const paymentRate = orderCount ? Math.round(paidOrdersCount / orderCount * 100) : 0
    const badges: string[] = []
    if (orderCount >= 1) badges.push('🌱 Aktif')
    if (orderCount >= 2) badges.push('🔥 Rutin')
    if (paymentRate === 100 && orderCount > 0) badges.push('⚡ Bayar Cepat')
    if (totalSpend >= 100000) badges.push('⭐ Loyal')
    return { id: member.id, name: member.name, phone: member.phone, groupName: member.group?.name ?? '-', role: member.role, orderCount, paidOrdersCount, totalSpend, paymentRate, badges, score: orderCount ? orderCount * 10 + Math.floor(totalSpend / 10000) + Math.round(paymentRate / 10) : 0 }
  }).sort((a, b) => b.score - a.score || b.totalSpend - a.totalSpend || a.name.localeCompare(b.name))
  const groupStats = groups.map((group) => {
    const activeOrderingMembers = group.members.filter((member) => member.orders.length > 0).length
    const totalGroupSpend = group.members.flatMap((member) => member.orders).reduce((sum, order) => sum + number(order.totalAmount), 0)
    return { id: group.id, name: group.name, level: group.level, totalMembers: group.members.length, activeOrderingMembers, participationRate: group.members.length ? Math.round(activeOrderingMembers / group.members.length * 100) : 0, totalGroupSpend }
  }).sort((a, b) => b.participationRate - a.participationRate || b.totalGroupSpend - a.totalGroupSpend || a.name.localeCompare(b.name))
  return { leaderboard, groupStats }
}

export async function getLegacyReports(prisma: PrismaClient, type: 'targets' | 'financial' | 'commodity' | 'member' | 'receivable') {
  if (type === 'commodity') {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, unit: true, category: true, isTarget: true, targetQuantity: true,
        orderItems: { select: { quantity: true, subtotal: true } },
        goodsReceiptItems: { select: { receivedQty: true, damagedQty: true, purchasePrice: true } },
      },
      orderBy: [{ isTarget: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
    const commodities = products.map((product) => {
      const totalOrderedQty = product.orderItems.reduce((sum, item) => sum + number(item.quantity), 0)
      const totalRevenue = product.orderItems.reduce((sum, item) => sum + number(item.subtotal), 0)
      const totalReceivedQty = product.goodsReceiptItems.reduce((sum, item) => sum + number(item.receivedQty), 0)
      const totalDamagedQty = product.goodsReceiptItems.reduce((sum, item) => sum + number(item.damagedQty), 0)
      const totalCost = product.goodsReceiptItems.reduce((sum, item) => sum + number(item.purchasePrice) * number(item.receivedQty), 0)
      const grossProfit = totalRevenue - totalCost
      return {
        productId: product.id, name: product.name, unit: product.unit, category: product.category,
        isTarget: product.isTarget, targetQuantity: product.targetQuantity ? number(product.targetQuantity) : null,
        totalOrderedQty, totalReceivedQty, totalDamagedQty, totalRevenue, totalCost, grossProfit,
        profitMarginPct: totalRevenue ? Math.round(grossProfit / totalRevenue * 100) : 0,
        avgSellingPrice: totalOrderedQty ? Math.round(totalRevenue / totalOrderedQty) : 0,
        avgPurchasePrice: totalReceivedQty ? Math.round(totalCost / totalReceivedQty) : 0,
        orderCount: product.orderItems.length,
      }
    })
    return {
      commodities,
      topByRevenue: [...commodities].sort((a, b) => b.totalRevenue - a.totalRevenue),
      chartData: commodities.slice(0, 6).map((item) => ({ name: item.name, Dipesan: item.totalOrderedQty, Diterima: item.totalReceivedQty, Rusak: item.totalDamagedQty })),
    }
  }

  if (type === 'member') {
    const [members, groups] = await Promise.all([
      prisma.member.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, phone: true, role: true, group: { select: { name: true } },
          orders: { select: { totalAmount: true, paymentStatus: true, createdAt: true } },
        },
      }),
      prisma.group.findMany({
        where: { level: { in: [2, 3] }, isActive: true },
        select: { id: true, name: true, level: true, members: { where: { isActive: true }, select: { orders: { select: { totalAmount: true } } } } },
      }),
    ])
    const memberStats = members.map((member) => {
      const orderCount = member.orders.length
      const totalSpend = member.orders.reduce((sum, order) => sum + number(order.totalAmount), 0)
      const paidCount = member.orders.filter((order) => order.paymentStatus === 'paid').length
      return {
        memberId: member.id, name: member.name, phone: member.phone, groupName: member.group?.name ?? '-', role: member.role,
        orderCount, totalSpend, paidCount, unpaidCount: orderCount - paidCount,
        unpaidAmount: member.orders.filter((order) => order.paymentStatus !== 'paid').reduce((sum, order) => sum + number(order.totalAmount), 0),
        paymentRate: orderCount ? Math.round(paidCount / orderCount * 100) : 0,
        lastOrderDate: member.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null,
      }
    }).sort((a, b) => b.totalSpend - a.totalSpend)
    const groupStats = groups.map((group) => {
      const activeMembers = group.members.filter((member) => member.orders.length > 0).length
      return {
        groupId: group.id, name: group.name, level: group.level, totalMembers: group.members.length, activeMembers,
        totalOrders: group.members.reduce((sum, member) => sum + member.orders.length, 0),
        totalSpend: group.members.flatMap((member) => member.orders).reduce((sum, order) => sum + number(order.totalAmount), 0),
        totalGroupSpend: group.members.flatMap((member) => member.orders).reduce((sum, order) => sum + number(order.totalAmount), 0),
        participationRate: group.members.length ? Math.round(activeMembers / group.members.length * 100) : 0,
      }
    })
    return { members: memberStats, groups: groupStats }
  }

  if (type === 'receivable') {
    const orders = await prisma.order.findMany({
      where: { paymentStatus: { not: 'paid' } },
      select: {
        id: true, cycleId: true, memberId: true, totalAmount: true, orderStatus: true, createdAt: true,
        cycle: { select: { label: true } },
        member: { select: { name: true, phone: true, group: { select: { name: true } } } },
        items: { select: { quantity: true, product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const now = Date.now()
    const formatted = orders.map((order) => ({
      orderId: order.id, cycleId: order.cycleId, cycleLabel: order.cycle.label, memberId: order.memberId,
      memberName: order.member.name, memberPhone: order.member.phone, groupName: order.member.group?.name ?? '-',
      totalAmount: number(order.totalAmount), orderStatus: order.orderStatus, createdAt: order.createdAt,
      daysOverdue: Math.max(0, Math.floor((now - order.createdAt.getTime()) / 86_400_000)),
      itemSummary: order.items.map((item) => `${item.product.name} (${number(item.quantity)} ${item.product.unit})`).join(', '),
    }))
    const byMember = new Map<string, { memberName: string; memberPhone: string; groupName: string; totalUnpaid: number; ordersCount: number }>()
    for (const order of formatted) {
      const current = byMember.get(order.memberId) ?? { memberName: order.memberName, memberPhone: order.memberPhone, groupName: order.groupName, totalUnpaid: 0, ordersCount: 0 }
      current.totalUnpaid += order.totalAmount
      current.ordersCount += 1
      byMember.set(order.memberId, current)
    }
    const memberReceivables = [...byMember.entries()].map(([memberId, value]) => ({ memberId, ...value })).sort((a, b) => b.totalUnpaid - a.totalUnpaid)
    return {
      summary: { totalUnpaidAmount: formatted.reduce((sum, order) => sum + order.totalAmount, 0), totalUnpaidOrders: formatted.length, totalMembersWithDebt: memberReceivables.length },
      orders: formatted, members: memberReceivables,
    }
  }

  const cycles = await prisma.cycle.findMany({
    select: {
      id: true, label: true, status: true, periodStart: true, deliveryDate: true,
      orders: { select: {
        totalAmount: true, paymentStatus: true,
        items: { select: { quantity: true, subtotal: true, product: { select: { name: true } } } },
      } },
      goodsReceipt: { select: { items: { select: { receivedQty: true, purchasePrice: true, product: { select: { name: true } } } } } },
    },
    orderBy: { periodStart: 'asc' },
  })

  if (type === 'financial') {
    const reports = cycles.map((cycle) => {
      const totalRevenue = cycle.orders.reduce((sum, order) => sum + number(order.totalAmount), 0)
      const paidRevenue = cycle.orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + number(order.totalAmount), 0)
      const totalCost = cycle.goodsReceipt?.items.reduce((sum, item) => sum + number(item.purchasePrice) * number(item.receivedQty), 0) ?? 0
      const grossMargin = totalRevenue - totalCost
      return {
        cycleId: cycle.id, cycleLabel: cycle.label, status: cycle.status, periodStart: cycle.periodStart, deliveryDate: cycle.deliveryDate,
        orderCount: cycle.orders.length, totalRevenue, paidRevenue, unpaidRevenue: totalRevenue - paidRevenue,
        totalCost, grossMargin, marginPct: totalRevenue ? Math.round(grossMargin / totalRevenue * 100) : 0,
        collectionRate: totalRevenue ? Math.round(paidRevenue / totalRevenue * 100) : 0, hasReceipt: Boolean(cycle.goodsReceipt),
      }
    })
    const totalRevenue = reports.reduce((sum, item) => sum + item.totalRevenue, 0)
    const totalPaid = reports.reduce((sum, item) => sum + item.paidRevenue, 0)
    const totalCost = reports.reduce((sum, item) => sum + item.totalCost, 0)
    return {
      summary: {
        totalRevenue, totalPaid, totalUnpaid: totalRevenue - totalPaid, totalCost, totalGrossMargin: totalRevenue - totalCost,
        overallMarginPct: totalRevenue ? Math.round((totalRevenue - totalCost) / totalRevenue * 100) : 0,
        overallCollectionRate: totalRevenue ? Math.round(totalPaid / totalRevenue * 100) : 0, totalCycles: cycles.length,
      },
      cycles: reports,
      chartData: reports.map((item) => ({ name: item.cycleLabel.replace(' - ', '\n'), shortLabel: item.cycleLabel, Pendapatan: item.totalRevenue, Modal: item.totalCost, Margin: item.grossMargin, Terbayar: item.paidRevenue, Piutang: item.unpaidRevenue })),
    }
  }

  let previousChicken = 0
  let previousTofu = 0
  const cycleReports = cycles.map((cycle) => {
    const orderItems = cycle.orders.flatMap((order) => order.items)
    const sold = (needle: string) => orderItems.filter((item) => item.product.name.toLocaleLowerCase('id-ID').includes(needle)).reduce((sum, item) => sum + number(item.quantity), 0)
    const received = (predicate: (name: string) => boolean) => cycle.goodsReceipt?.items.filter((item) => predicate(item.product.name.toLocaleLowerCase('id-ID'))).reduce((sum, item) => sum + number(item.receivedQty), 0) ?? 0
    const karkas = sold('karkas'), recah = sold('recah'), gebrus = sold('gebrus')
    const chickenSold = karkas + recah + gebrus
    const kuning = sold('tahu kuning'), putih = sold('tahu putih')
    const tofuSold = kuning + putih || sold('tahu')
    const chickenTarget = 20, tofuTarget = 20
    const chickenGoodsIn = received((name) => ['karkas', 'recah', 'gebrus'].some((needle) => name.includes(needle))) || Math.max(chickenTarget, chickenSold)
    const tofuGoodsIn = received((name) => name.includes('tahu')) || Math.max(tofuTarget, tofuSold)
    const chickenEnding = Math.max(0, previousChicken + chickenGoodsIn - chickenSold)
    const tofuEnding = Math.max(0, previousTofu + tofuGoodsIn - tofuSold)
    const result = {
      cycleId: cycle.id, cycleLabel: cycle.label, status: cycle.status, periodStart: cycle.periodStart, deliveryDate: cycle.deliveryDate,
      chicken: { target: chickenTarget, sold: chickenSold, beginningStock: previousChicken, goodsIn: chickenGoodsIn, available: previousChicken + chickenGoodsIn, endingStock: chickenEnding, isMet: chickenSold >= chickenTarget, shortfall: Math.max(0, chickenTarget - chickenSold), percentage: Math.round(chickenSold / chickenTarget * 100), breakdown: { karkas, recah, gebrus } },
      tofu: { target: tofuTarget, sold: tofuSold, beginningStock: previousTofu, goodsIn: tofuGoodsIn, available: previousTofu + tofuGoodsIn, endingStock: tofuEnding, isMet: tofuSold >= tofuTarget, shortfall: Math.max(0, tofuTarget - tofuSold), percentage: Math.round(tofuSold / tofuTarget * 100), breakdown: { kuning, putih } },
    }
    previousChicken = chickenEnding
    previousTofu = tofuEnding
    return result
  })
  const chickenMetCount = cycleReports.filter((item) => item.chicken.isMet).length
  const tofuMetCount = cycleReports.filter((item) => item.tofu.isMet).length
  return {
    summary: { totalCycles: cycleReports.length, chickenSuccessRate: cycleReports.length ? Math.round(chickenMetCount / cycleReports.length * 100) : 0, tofuSuccessRate: cycleReports.length ? Math.round(tofuMetCount / cycleReports.length * 100) : 0, currentChickenLeftover: cycleReports.at(-1)?.chicken.endingStock ?? 0, currentTofuLeftover: cycleReports.at(-1)?.tofu.endingStock ?? 0, chickenMetCount, tofuMetCount },
    cycleReports,
    chartData: cycleReports.map((item) => ({ name: item.cycleLabel, 'Ayam Terjual': item.chicken.sold, 'Target Ayam': item.chicken.target, 'Sisa Ayam': item.chicken.endingStock, 'Tahu Terjual': item.tofu.sold, 'Target Tahu': item.tofu.target, 'Sisa Tahu': item.tofu.endingStock })),
  }
}

export async function getLegacyCycleDetail(prisma: PrismaClient, cycleId: string) {
  const summary = await getLegacyDashboardSummary(prisma, cycleId)
  if (!summary.currentCycle || !summary.rotation || !summary.finances) throw new Error('Siklus tidak ditemukan')
  return {
    operational: {
      cycle: summary.currentCycle,
      targets: summary.targets,
      rotation: summary.rotation,
      finances: { ...summary.finances, totalIncomplete: false },
    },
  }
}

export async function getLegacySupplierRecap(prisma: PrismaClient, cycleId: string) {
  const [summary, cycle, pricedProducts, orderItems] = await Promise.all([
    getLegacyDashboardSummary(prisma, cycleId),
    prisma.cycle.findUnique({ where: { id: cycleId }, select: { status: true } }),
    prisma.weeklyPrice.findMany({
      where: { cycleId },
      select: { product: { select: { id: true, name: true, unit: true, sortOrder: true } } },
      orderBy: { product: { sortOrder: 'asc' } },
    }),
    prisma.orderItem.findMany({
      where: { order: { cycleId } },
      select: { productId: true, quantity: true },
    }),
  ])
  if (!cycle || !summary.currentCycle) throw new Error('Siklus tidak ditemukan')
  const demandByProduct = new Map<string, number>()
  for (const item of orderItems) demandByProduct.set(item.productId, (demandByProduct.get(item.productId) ?? 0) + number(item.quantity))
  const items = pricedProducts.map(({ product }) => ({
    productId: product.id, productName: product.name, unit: product.unit,
    groupCode: groupCode(product.name) ?? 'NONE' as const,
    demand: (demandByProduct.get(product.id) ?? 0).toFixed(2),
  }))
  const groups = (['AYAM', 'TAHU'] as const).map((code) => {
    const target = summary.targets.find((item) => item.groupCode === code)
    const targetValue = target?.target ?? '0.00'
    const demandValue = target?.demand ?? '0.00'
    const targetNumber = Number(targetValue)
    const demandNumber = Number(demandValue)
    return {
      groupCode: code, target: targetValue, demand: demandValue,
      percentage: targetNumber > 0 ? Math.round(demandNumber / targetNumber * 100) : null,
      shortfall: Math.max(0, targetNumber - demandNumber).toFixed(2),
      plannedPurchase: Math.max(targetNumber, demandNumber).toFixed(2),
    }
  })
  return { cycleId, cycleVersion: 0, periodState: phase(cycle.status), groups, items, confirmed: null }
}
