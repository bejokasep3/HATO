import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 1. Members Leaderboard
    const members = await prisma.member.findMany({
      where: { isActive: true },
      include: {
        group: true,
        orders: {
          include: {
            items: true,
          },
        },
      },
    })

    const memberStats = members.map((m) => {
      const orderCount = m.orders.length
      const totalSpend = m.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
      const paidOrdersCount = m.orders.filter((o) => o.paymentStatus === 'paid').length
      // Payment rate is only applicable when member actually placed orders
      const paymentRate = orderCount > 0 ? Math.round((paidOrdersCount / orderCount) * 100) : 0

      // Badges
      const badges: string[] = []
      if (orderCount >= 1) badges.push('🌱 Aktif')
      if (orderCount >= 2) badges.push('🔥 Rutin')
      if (paymentRate === 100 && orderCount > 0) badges.push('⚡ Bayar Cepat')
      if (totalSpend >= 100000) badges.push('⭐ Loyal')

      // Scaled-down Score formula (compact, eliminates excessive zeros as cycles accumulate):
      // - 10 pts per order placed (kehadiran)
      // - 1 pt per Rp 10.000 spent (volume belanja)
      // - Up to 10 pts bonus for 100% payment (disiplin bayar tepat waktu)
      const orderPts = orderCount * 10
      const spendPts = Math.floor(totalSpend / 10000)
      const paymentPts = Math.round(paymentRate / 10)
      const score = orderCount > 0 ? orderPts + spendPts + paymentPts : 0

      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        groupName: m.group?.name || '-',
        role: m.role,
        orderCount,
        paidOrdersCount,
        totalSpend,
        paymentRate,
        badges,
        score,
      }
    })

    // Sort: highest score, then highest spend, then most orders, then payment rate, then name
    memberStats.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
      if (b.paymentRate !== a.paymentRate) return b.paymentRate - a.paymentRate
      return a.name.localeCompare(b.name)
    })

    // 2. Group Rankings (includes both Level 2 Sub-groups and Level 3 Main Group)
    const groups = await prisma.group.findMany({
      where: { level: { in: [2, 3] }, isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: {
            orders: true,
          },
        },
      },
    })

    const groupStats = groups.map((g) => {
      const totalMembers = g.members.length
      const activeOrderingMembers = g.members.filter((m) => m.orders.length > 0).length
      const totalGroupSpend = g.members.reduce(
        (sum, m) => sum + m.orders.reduce((s, o) => s + Number(o.totalAmount), 0),
        0
      )
      const participationRate =
        totalMembers > 0 ? Math.round((activeOrderingMembers / totalMembers) * 100) : 0

      return {
        id: g.id,
        name: g.name,
        level: g.level,
        totalMembers,
        activeOrderingMembers,
        participationRate,
        totalGroupSpend,
      }
    })

    groupStats.sort((a, b) => {
      if (b.participationRate !== a.participationRate) return b.participationRate - a.participationRate
      if (b.totalGroupSpend !== a.totalGroupSpend) return b.totalGroupSpend - a.totalGroupSpend
      if (b.totalMembers !== a.totalMembers) return b.totalMembers - a.totalMembers
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      leaderboard: memberStats,
      groupStats,
    })
  } catch (error) {
    console.error('Error fetching rankings:', error)
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 })
  }
}
