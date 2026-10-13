import { type PrismaClient } from '@prisma/client'
import { paymentSummary } from '../domain/payments'
import { sumMoney } from '../domain/money'
import { getReports } from './reports'
import { getCycleAvailability } from './availability'
import { getCycleSummary } from './operational-summary'
import { getRanking } from './ranking'

const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0
const nullableSum = (values: (number | null)[]) => values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0)

export async function getReportTabs(prisma: PrismaClient, type: 'targets' | 'financial' | 'commodity' | 'member' | 'receivable') {
  if (type === 'receivable') {
    const candidates = await prisma.order.findMany({
      where: { cancelledAt: null }, include: { payments: true, cycle: true, member: { include: { group: true } }, items: { include: { product: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    let unknownBalanceCount = 0
    const orders = candidates.flatMap((order) => {
      const balance = paymentSummary(order.totalAmount.toFixed(2), order.payments.map((entry) => ({ amount: entry.amount.toFixed(2), reversed: Boolean(entry.reversedAt) })), Boolean(order.ledgerReconciledAt))
      if (balance.status === 'unverified') { unknownBalanceCount++; return [] }
      if (Number(balance.outstandingAmount) <= 0) return []
      return [{ orderId: order.id, cycleId: order.cycleId, cycleLabel: order.cycle.label, memberId: order.memberId, memberName: order.member.name, memberPhone: order.member.phone, groupName: order.member.group.name,
        totalAmount: Number(balance.outstandingAmount), originalAmount: Number(order.totalAmount), paidAmount: Number(balance.paidAmount), orderStatus: order.orderStatus, createdAt: order.createdAt,
        daysOverdue: Math.max(0, Math.floor((Date.now() - order.createdAt.getTime()) / 86400000)), itemSummary: order.items.map((item) => `${item.product.name} (${item.quantity.toString()} ${item.product.unit})`).join(', '),
      }]
    })
    const byMember = new Map<string, { memberId: string; memberName: string; memberPhone: string; groupName: string; totalUnpaid: number; ordersCount: number }>()
    for (const order of orders) {
      const member = byMember.get(order.memberId) ?? { memberId: order.memberId, memberName: order.memberName, memberPhone: order.memberPhone, groupName: order.groupName, totalUnpaid: 0, ordersCount: 0 }
      member.totalUnpaid += order.totalAmount; member.ordersCount++
      byMember.set(order.memberId, member)
    }
    return { summary: { totalUnpaidAmount: Number(sumMoney(orders.map((order) => order.totalAmount.toFixed(2)))), totalUnpaidOrders: orders.length, totalMembersWithDebt: byMember.size, unknownBalanceCount }, orders, members: [...byMember.values()].sort((a, b) => b.totalUnpaid - a.totalUnpaid), unknownBalanceCount }
  }

  if (type === 'member') {
    const [ranking, data] = await Promise.all([getRanking(prisma), getReports(prisma, 'member')])
    if (!('members' in data) || !data.members) throw new Error('INVALID_MEMBER_REPORT')
    const balances = new Map(data.members.map((member) => [member.memberId, member]))
    return { members: ranking.leaderboard.map((member) => {
      const balance = balances.get(member.id)!
      return { memberId: member.id, name: member.name, phone: member.phone, role: member.role, groupName: member.groupName, orderCount: member.orderCount, totalSpend: member.totalSpend, paidCount: member.paidOrdersCount, unpaidCount: member.orderCount - member.paidOrdersCount, unpaidAmount: balance.unknownBalanceCount ? null : Number(balance.knownOutstanding), paymentRate: member.paymentRate }
    }), groups: ranking.groupStats.map((group) => ({ ...group, groupId: group.id, activeMembers: group.activeOrderingMembers })), unknownBalanceCount: data.members.reduce((sum, member) => sum + member.unknownBalanceCount, 0) }
  }

  if (type === 'commodity') {
    const [data, products] = await Promise.all([getReports(prisma, 'commodity'), prisma.product.findMany({ select: { id: true, category: true } })])
    if (!('products' in data) || !data.products) throw new Error('INVALID_COMMODITY_REPORT')
    const categories = new Map(products.map((product) => [product.id, product.category]))
    const commodities = data.products.map((product) => {
      const totalRevenue = Number(product.orderValue), totalCost = product.purchaseValue === null ? null : Number(product.purchaseValue)
      const totalOrderedQty = Number(product.orderedQuantity), totalReceivedQty = Number(product.receivedQuantity)
      const grossProfit = totalCost === null || product.pricingPendingCount > 0 ? null : totalRevenue - totalCost
      return { productId: product.productId, name: product.name, unit: product.unit, category: categories.get(product.productId), totalOrderedQty, totalReceivedQty: product.confirmedReceiptCount ? totalReceivedQty : null, totalDamagedQty: product.confirmedReceiptCount ? Number(product.damagedQuantity) : null, totalRevenue: product.pricingPendingCount ? null : totalRevenue, totalCost, grossProfit, profitMarginPct: grossProfit === null ? null : percent(grossProfit, totalRevenue), avgSellingPrice: product.pricingPendingCount ? null : totalOrderedQty ? Math.round(totalRevenue / totalOrderedQty) : 0, avgPurchasePrice: totalCost === null ? null : totalReceivedQty ? Math.round(totalCost / totalReceivedQty) : 0 }
    })
    return { commodities, topByRevenue: [...commodities].sort((a, b) => (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0)), chartData: commodities.slice(0, 6).map((item) => ({ name: item.name, Dipesan: item.totalOrderedQty, Diterima: item.totalReceivedQty, Rusak: item.totalDamagedQty })) }
  }

  if (type === 'financial') {
    const data = await getReports(prisma, 'financial')
    if (!('overall' in data) || !data.overall || !data.cycleReports) throw new Error('INVALID_FINANCIAL_REPORT')
    const cycles = data.cycleReports.map((cycle) => {
      if (!('orderValue' in cycle)) throw new Error('INVALID_FINANCIAL_CYCLE')
      const totalRevenue = Number(cycle.orderValue), paidRevenue = Number(cycle.receivedPayments)
      const totalCost = cycle.purchaseValue === null ? null : Number(cycle.purchaseValue)
      const grossMargin = totalCost === null || cycle.unknownBalanceCount ? null : totalRevenue - totalCost
      return { cycleId: cycle.id, cycleLabel: cycle.label, status: cycle.status, periodStart: cycle.periodStart, deliveryDate: cycle.deliveryDate, orderCount: cycle.orderCount, totalRevenue: cycle.unknownBalanceCount ? null : totalRevenue, paidRevenue, unpaidRevenue: cycle.unknownBalanceCount ? null : Number(cycle.knownOutstanding), totalCost, grossMargin, marginPct: grossMargin === null ? null : percent(grossMargin, totalRevenue), collectionRate: cycle.unknownBalanceCount ? null : percent(paidRevenue, totalRevenue), hasReceipt: totalCost !== null }
    })
    const totalRevenue = nullableSum(cycles.map((cycle) => cycle.totalRevenue)), totalPaid = Number(data.overall.receivedPayments), totalCost = nullableSum(cycles.map((cycle) => cycle.totalCost))
    const totalGrossMargin = totalRevenue === null || totalCost === null ? null : totalRevenue - totalCost
    return { summary: { totalRevenue, totalPaid, totalUnpaid: data.overall.unknownBalanceCount ? null : Number(data.overall.knownOutstanding), totalCost, totalGrossMargin, overallMarginPct: totalGrossMargin === null ? null : percent(totalGrossMargin, totalRevenue!), overallCollectionRate: totalRevenue === null ? null : percent(totalPaid, totalRevenue), totalCycles: cycles.length }, cycles, chartData: cycles.map((cycle) => ({ name: cycle.cycleLabel, shortLabel: cycle.cycleLabel, Pendapatan: cycle.totalRevenue, Modal: cycle.totalCost, Margin: cycle.grossMargin, Terbayar: cycle.paidRevenue, Piutang: cycle.unpaidRevenue })), unknownBalanceCount: data.overall.unknownBalanceCount }
  }

  const cycles = await prisma.cycle.findMany({ include: { weeklyPrices: { include: { product: true } }, goodsReceipt: { include: { items: true } }, orders: { where: { cancelledAt: null }, include: { items: true } } }, orderBy: { periodStart: 'asc' } })
  const cycleReports = await Promise.all(cycles.map(async (cycle) => {
    const [summary, availability] = await Promise.all([getCycleSummary(prisma, cycle.id), cycle.rulesVersion === 2 ? getCycleAvailability(prisma, cycle.id) : Promise.resolve({ items: [] })])
    const group = (code: 'AYAM' | 'TAHU') => {
      const target = summary.targets.find((item) => item.groupCode === code)!
      const prices = cycle.weeklyPrices.filter((price) => price.targetGroupSnapshot === code)
      const ids = new Set(prices.map((price) => price.productId))
      const stock = availability.items.filter((item) => ids.has(item.productId))
      const receiptKnown = cycle.rulesVersion === 2 && cycle.goodsReceipt?.status === 'confirmed'
      const goodsIn = receiptKnown ? Number(sumMoney(cycle.goodsReceipt!.items.filter((item) => ids.has(item.productId)).map((item) => item.receivedQty.toFixed(2)))) : null
      const endingStock = receiptKnown ? nullableSum(stock.map((item) => item.physicalRemaining === null ? null : Number(item.physicalRemaining))) : null
      const targetValue = target.target === null ? null : Number(target.target), sold = target.demand === null ? null : Number(target.demand)
      const namedQuantity = (needle: string) => {
        const namedIds = new Set(prices.filter((price) => price.product.name.toLowerCase().includes(needle)).map((price) => price.productId))
        return Number(sumMoney(cycle.orders.flatMap((order) => order.items).filter((item) => namedIds.has(item.productId)).map((item) => item.quantity.toFixed(2))))
      }
      return { target: targetValue, sold, beginningStock: null, goodsIn, available: goodsIn, endingStock, isMet: targetValue === null || sold === null ? null : sold >= targetValue, shortfall: targetValue === null || sold === null ? null : Math.max(0, targetValue - sold), percentage: targetValue === null || sold === null ? null : percent(sold, targetValue), breakdown: { karkas: namedQuantity('karkas'), recah: namedQuantity('recah'), gebrus: namedQuantity('gebrus'), kuning: namedQuantity('kuning'), putih: namedQuantity('putih') } }
    }
    return { cycleId: cycle.id, cycleLabel: cycle.label, status: cycle.status, periodStart: cycle.periodStart, deliveryDate: cycle.deliveryDate, chicken: group('AYAM'), tofu: group('TAHU') }
  }))
  const knownChicken = cycleReports.filter((cycle) => cycle.chicken.isMet !== null), knownTofu = cycleReports.filter((cycle) => cycle.tofu.isMet !== null)
  const chickenMetCount = knownChicken.filter((cycle) => cycle.chicken.isMet).length, tofuMetCount = knownTofu.filter((cycle) => cycle.tofu.isMet).length
  return { summary: { totalCycles: cycleReports.length, knownChickenCycleCount: knownChicken.length, knownTofuCycleCount: knownTofu.length, chickenMetCount, tofuMetCount, chickenSuccessRate: knownChicken.length ? percent(chickenMetCount, knownChicken.length) : null, tofuSuccessRate: knownTofu.length ? percent(tofuMetCount, knownTofu.length) : null, currentChickenLeftover: cycleReports.at(-1)?.chicken.endingStock ?? null, currentTofuLeftover: cycleReports.at(-1)?.tofu.endingStock ?? null }, cycleReports, chartData: cycleReports.map((cycle) => ({ name: cycle.cycleLabel, 'Ayam Terjual': cycle.chicken.sold, 'Target Ayam': cycle.chicken.target, 'Sisa Ayam': cycle.chicken.endingStock, 'Tahu Terjual': cycle.tofu.sold, 'Target Tahu': cycle.tofu.target, 'Sisa Tahu': cycle.tofu.endingStock })) }
}
