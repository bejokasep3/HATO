import { type PrismaClient } from '@prisma/client'
import { formatScaled, lineSubtotal, parseScaled, sumMoney } from '../domain/money'
import { paymentSummary } from '../domain/payments'
import { getCycleSummary } from './operational-summary'
import { getReceivables } from './payments'

export async function getReports(prisma: PrismaClient, type: 'targets' | 'financial' | 'commodity' | 'member' | 'receivable') {
  if (type === 'receivable') return getReceivables(prisma, { page: 1, pageSize: 30 })
  if (type === 'commodity') {
    const products = await prisma.product.findMany({
      include: {
        orderItems: { include: { order: true } },
        goodsReceiptItems: { include: { goodsReceipt: true } },
      }, orderBy: { sortOrder: 'asc' },
    })
    return { products: products.map((product) => {
      const activeItems = product.orderItems.filter((item) => !item.order.cancelledAt)
      const confirmedReceipts = product.goodsReceiptItems.filter((item) => item.goodsReceipt.status === 'confirmed')
      const receivedLines = confirmedReceipts.filter((item) => item.receivedQty.greaterThan(0))
      return {
        productId: product.id, name: product.name, unit: product.unit,
        orderedQuantity: formatScaled(activeItems.reduce((sum, item) => sum + parseScaled(item.quantity.toFixed(2), 2, 8), 0n)),
        receivedQuantity: formatScaled(confirmedReceipts.reduce((sum, item) => sum + parseScaled(item.receivedQty.toFixed(2), 2, 8), 0n)),
        damagedQuantity: formatScaled(confirmedReceipts.reduce((sum, item) => sum + parseScaled(item.damagedQty.toFixed(2), 2, 8), 0n)),
        orderValue: sumMoney(activeItems.map((item) => item.subtotal.toFixed(2))),
        purchaseValue: receivedLines.every((item) => item.purchasePrice.greaterThan(0))
          ? sumMoney(receivedLines.map((item) => lineSubtotal(item.purchasePrice.toFixed(2), item.receivedQty.toFixed(2))))
          : null,
      }
    }) }
  }
  if (type === 'member') {
    const members = await prisma.member.findMany({ include: { group: true, orders: { where: { cancelledAt: null }, include: { payments: true } } }, orderBy: { name: 'asc' } })
    return { members: members.map((member) => {
      const verified = member.orders.filter((order) => Boolean(order.ledgerReconciledAt))
      const summaries = verified.map((order) => paymentSummary(order.totalAmount.toFixed(2), order.payments.map((payment) => ({ amount: payment.amount.toFixed(2), reversed: Boolean(payment.reversedAt) })), true))
      return {
        memberId: member.id, name: member.name, groupName: member.group.name,
        orderCount: member.orders.length,
        orderValue: sumMoney(member.orders.map((order) => order.totalAmount.toFixed(2))),
        receivedPayments: sumMoney(summaries.map((summary) => summary.paidAmount!)),
        knownOutstanding: sumMoney(summaries.map((summary) => summary.outstandingAmount!)),
        unknownBalanceCount: member.orders.length - verified.length,
      }
    }) }
  }

  const cycles = await prisma.cycle.findMany({ orderBy: { periodStart: 'asc' }, select: { id: true } })
  const summaries = await Promise.all(cycles.map((cycle) => getCycleSummary(prisma, cycle.id)))
  if (type === 'targets') {
    return { cycleReports: summaries.map((summary) => ({ ...summary.cycle, targets: summary.targets })) }
  }
  const finances = summaries.map((summary) => ({ ...summary.cycle, ...summary.finances }))
  return {
    cycleReports: finances,
    overall: {
      cycleCount: finances.length,
      orderValue: sumMoney(finances.map((cycle) => cycle.orderValue)),
      receivedPayments: sumMoney(finances.map((cycle) => cycle.receivedPayments)),
      knownOutstanding: sumMoney(finances.map((cycle) => cycle.knownOutstanding)),
      confirmedPurchaseValue: sumMoney(finances.filter((cycle) => cycle.purchaseValue !== null).map((cycle) => cycle.purchaseValue!)),
      unknownBalanceCount: finances.reduce((sum, cycle) => sum + cycle.unknownBalanceCount, 0),
      unknownPurchaseCycleCount: finances.filter((cycle) => cycle.purchaseValue === null).length,
    },
  }
}
