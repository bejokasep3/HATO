import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { parseScaled, sumMoney } from '@/lib/domain/money'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextResponse } from 'next/server'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyRanking } from '@/lib/services/legacy-readers'

async function GETImpl() {
  try {
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyRanking(prisma))
    const [members, groups] = await Promise.all([
      prisma.member.findMany({ where: { isActive: true }, include: { group: true, orders: { where: { cancelledAt: null } } } }),
      prisma.group.findMany({ where: { isActive: true, level: { in: [2, 3] } }, include: { members: { where: { isActive: true }, include: { orders: { where: { cancelledAt: null } } } } } }),
    ])
    const leaderboard = members.map((member) => ({
      id: member.id, name: member.name, groupName: member.group.name,
      orderCount: member.orders.length,
      orderValue: sumMoney(member.orders.map((order) => order.totalAmount.toFixed(2))),
      unknownBalanceCount: member.orders.filter((order) => !order.ledgerReconciledAt).length,
    })).sort((a, b) => {
      const difference = parseScaled(b.orderValue, 2, 10) - parseScaled(a.orderValue, 2, 10)
      return difference > 0n ? 1 : difference < 0n ? -1 : a.name.localeCompare(b.name)
    })
    const groupStats = groups.map((group) => {
      const activeOrderingMembers = group.members.filter((member) => member.orders.length > 0).length
      return {
        id: group.id, name: group.name, level: group.level,
        totalMembers: group.members.length, activeOrderingMembers,
        participationRate: group.members.length ? Math.round(activeOrderingMembers / group.members.length * 100) : 0,
        orderValue: sumMoney(group.members.flatMap((member) => member.orders.map((order) => order.totalAmount.toFixed(2)))),
      }
    }).sort((a, b) => b.participationRate - a.participationRate || a.name.localeCompare(b.name))
    return NextResponse.json({ leaderboard, groupStats })
  } catch (error) { return mutationErrorResponse(error) }
}

export const GET = withAdmin(GETImpl)
