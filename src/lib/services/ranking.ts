import { type PrismaClient } from '@prisma/client'
import { paymentSummary } from '../domain/payments'
import { sumMoney } from '../domain/money'

export async function getRanking(prisma: PrismaClient) {
  const [members, groups] = await Promise.all([
    prisma.member.findMany({ where: { isActive: true }, include: { group: true, orders: { where: { cancelledAt: null }, include: { payments: true, cycle: { select: { periodState: true } } } } } }),
    prisma.group.findMany({ where: { isActive: true, level: { in: [2, 3] } }, include: { members: { where: { isActive: true }, select: { id: true } } } }),
  ])
  const leaderboard = members.map((member) => {
    const orders = member.orders.filter((order) => order.cycle.periodState !== 'draft')
    const balances = orders.map((order) => paymentSummary(order.totalAmount.toFixed(2), order.payments.map((entry) => ({ amount: entry.amount.toFixed(2), reversed: Boolean(entry.reversedAt) })), Boolean(order.ledgerReconciledAt)))
    const orderCount = orders.length
    const totalSpend = Number(sumMoney(orders.map((order) => order.totalAmount.toFixed(2))))
    const paidOrdersCount = balances.filter((balance) => balance.status === 'paid').length
    const paymentRate = orderCount ? Math.round(paidOrdersCount / orderCount * 100) : 0
    const badges: string[] = []
    if (orderCount >= 1) badges.push('🌱 Aktif')
    if (orderCount >= 2) badges.push('🔥 Rutin')
    if (paymentRate === 100 && orderCount > 0) badges.push('⚡ Lunas')
    if (totalSpend >= 100000) badges.push('⭐ Loyal')
    return {
      id: member.id, name: member.name, phone: member.phone, role: member.role, groupName: member.group.name,
      orderCount, paidOrdersCount, totalSpend, paymentRate, badges,
      score: orderCount ? orderCount * 10 + Math.floor(totalSpend / 10000) + Math.round(paymentRate / 10) : 0,
      unknownBalanceCount: balances.filter((balance) => balance.status === 'unverified').length,
    }
  }).sort((a, b) => b.score - a.score || b.totalSpend - a.totalSpend || a.name.localeCompare(b.name))
  const byId = new Map(leaderboard.map((member) => [member.id, member]))
  const groupStats = groups.map((group) => {
    const rows = group.members.flatMap((member) => byId.get(member.id) ?? [])
    const activeOrderingMembers = rows.filter((member) => member.orderCount > 0).length
    return { id: group.id, name: group.name, level: group.level, totalMembers: rows.length, activeOrderingMembers, participationRate: rows.length ? Math.round(activeOrderingMembers / rows.length * 100) : 0, totalGroupSpend: rows.reduce((sum, member) => sum + member.totalSpend, 0) }
  }).sort((a, b) => b.participationRate - a.participationRate || b.totalGroupSpend - a.totalGroupSpend || a.name.localeCompare(b.name))
  return { leaderboard, groupStats }
}
