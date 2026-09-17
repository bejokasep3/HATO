import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycleId')

    // Fetch all available cycles for dashboard switcher
    const allCycles = await prisma.cycle.findMany({
      orderBy: { periodStart: 'desc' },
      select: {
        id: true,
        label: true,
        status: true,
        periodStart: true,
        orderDeadline: true,
        deliveryDate: true,
      },
    })

    let currentCycle: any = null

    // If specific cycleId requested, load that cycle
    if (cycleId) {
      currentCycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
        include: {
          weeklyPrices: {
            include: { product: true },
          },
        },
      })
    }

    // Default: prioritize current/upcoming 'open' cycle, or cycle covering today's date
    const now = new Date()
    if (!currentCycle) {
      currentCycle = await prisma.cycle.findFirst({
        where: {
          status: 'open',
          deliveryDate: { gte: now },
        },
        orderBy: { periodStart: 'desc' },
        include: {
          weeklyPrices: {
            include: { product: true },
          },
        },
      })

      if (!currentCycle) {
        currentCycle = await prisma.cycle.findFirst({
          where: {
            periodStart: { lte: now },
            deliveryDate: { gte: now },
          },
          orderBy: { periodStart: 'desc' },
          include: {
            weeklyPrices: {
              include: { product: true },
            },
          },
        })
      }

      if (!currentCycle) {
        currentCycle = await prisma.cycle.findFirst({
          where: { status: 'open' },
          orderBy: { periodStart: 'desc' },
          include: {
            weeklyPrices: {
              include: { product: true },
            },
          },
        })
      }

      if (!currentCycle) {
        currentCycle = await prisma.cycle.findFirst({
          where: { status: { in: ['draft', 'closed', 'delivered', 'completed'] } },
          orderBy: { periodStart: 'desc' },
          include: {
            weeklyPrices: {
              include: { product: true },
            },
          },
        })
      }
    }

    if (!currentCycle) {
      return NextResponse.json({
        hasCycle: false,
        allCycles: [],
        message: 'Belum ada siklus.',
      })
    }

    // 2. Target Progress (Ayam Campur 20kg & Tahu Kuning 20 bks) with multi-cycle stock tracking
    const allPriorCycles = await prisma.cycle.findMany({
      where: {
        periodStart: { lte: currentCycle.periodStart },
      },
      orderBy: { periodStart: 'asc' },
      include: {
        orders: {
          include: {
            items: { include: { product: true } },
          },
        },
        goodsReceipt: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    })

    let prevChickenLeftover = 0
    let prevTofuLeftover = 0

    let currentChickenStats: any = null
    let currentTofuStats: any = null

    for (const c of allPriorCycles) {
      const allItems = c.orders.flatMap((o) => o.items)

      // Chicken (Karkas, Recah, Gebrus)
      const karkas = allItems
        .filter((it) => it.product.name.toLowerCase().includes('karkas'))
        .reduce((sum, it) => sum + Number(it.quantity), 0)
      const recah = allItems
        .filter((it) => it.product.name.toLowerCase().includes('recah'))
        .reduce((sum, it) => sum + Number(it.quantity), 0)
      const gebrus = allItems
        .filter((it) => it.product.name.toLowerCase().includes('gebrus'))
        .reduce((sum, it) => sum + Number(it.quantity), 0)

      const chickenSold = karkas + recah + gebrus
      const chickenTarget = 20
      const chickenBegStock = prevChickenLeftover
      let chickenGoodsIn = Math.max(chickenTarget, chickenSold)
      if (c.goodsReceipt) {
        const rc = c.goodsReceipt.items
          .filter((it) => {
            const n = it.product.name.toLowerCase()
            return n.includes('karkas') || n.includes('recah') || n.includes('gebrus')
          })
          .reduce((sum, it) => sum + Number(it.receivedQty), 0)
        if (rc > 0) chickenGoodsIn = rc
      }
      const chickenAvail = chickenBegStock + chickenGoodsIn
      const chickenEndStock = Math.max(0, chickenAvail - chickenSold)
      prevChickenLeftover = chickenEndStock

      // Tofu (Kuning & Putih)
      const tahuKuning = allItems
        .filter((it) => {
          const n = it.product.name.toLowerCase()
          return n.includes('tahu') && (n.includes('kuning') || !n.includes('putih'))
        })
        .reduce((sum, it) => sum + Number(it.quantity), 0)
      const tahuPutih = allItems
        .filter((it) => {
          const n = it.product.name.toLowerCase()
          return n.includes('tahu') && n.includes('putih')
        })
        .reduce((sum, it) => sum + Number(it.quantity), 0)

      const tofuSold = tahuKuning + tahuPutih
      const tofuTarget = 20
      const tofuBegStock = prevTofuLeftover
      let tofuGoodsIn = Math.max(tofuTarget, tofuSold)
      if (c.goodsReceipt) {
        const rt = c.goodsReceipt.items
          .filter((it) => it.product.name.toLowerCase().includes('tahu'))
          .reduce((sum, it) => sum + Number(it.receivedQty), 0)
        if (rt > 0) tofuGoodsIn = rt
      }
      const tofuAvail = tofuBegStock + tofuGoodsIn
      const tofuEndStock = Math.max(0, tofuAvail - tofuSold)
      prevTofuLeftover = tofuEndStock

      if (c.id === currentCycle.id) {
        currentChickenStats = {
          id: 'target-ayam-campur',
          name: 'Ayam Campur (Karkas, Recah, Gebrus)',
          unit: 'kg',
          targetQuantity: chickenTarget,
          actualQuantity: chickenSold,
          beginningStock: chickenBegStock,
          goodsIn: chickenGoodsIn,
          unsoldStock: chickenEndStock,
          percentage: Math.round((chickenSold / chickenTarget) * 100),
          isMet: chickenSold >= chickenTarget,
          breakdown: [
            { name: 'Karkas', quantity: karkas },
            { name: 'Recah', quantity: recah },
            { name: 'Gebrus', quantity: gebrus },
          ],
        }

        currentTofuStats = {
          id: 'target-tahu-campur',
          name: 'Tahu Campur (Kuning & Putih)',
          unit: 'bungkus',
          targetQuantity: tofuTarget,
          actualQuantity: tofuSold,
          beginningStock: tofuBegStock,
          goodsIn: tofuGoodsIn,
          unsoldStock: tofuEndStock,
          percentage: Math.round((tofuSold / tofuTarget) * 100),
          isMet: tofuSold >= tofuTarget,
          breakdown: [
            { name: 'Tahu Kuning', quantity: tahuKuning },
            { name: 'Tahu Putih', quantity: tahuPutih },
          ],
        }
      }
    }

    const targetStats = [currentChickenStats, currentTofuStats].filter(Boolean)

    // 3. Payment & Orders summary
    const orders = await prisma.order.findMany({
      where: { cycleId: currentCycle.id },
      include: {
        member: { include: { group: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const orderedMemberIds = new Set(orders.map((o) => o.memberId))

    // 4. Get rotation progress (synced with actual orders)
    const rotationSchedules = await prisma.rotationSchedule.findMany({
      where: { cycleId: currentCycle.id },
      include: {
        member: {
          include: { group: true },
        },
      },
    })

    // Dynamically mark and persist as 'ordered' if member already placed an order
    for (const r of rotationSchedules) {
      if (orderedMemberIds.has(r.memberId)) {
        if (r.status !== 'ordered') {
          r.status = 'ordered'
          prisma.rotationSchedule
            .update({
              where: { id: r.id },
              data: { status: 'ordered' },
            })
            .catch(() => {})
        }
      }
    }

    const scheduledCount = rotationSchedules.length
    const orderedCount = rotationSchedules.filter(
      (r) => r.status === 'ordered' || orderedMemberIds.has(r.memberId)
    ).length

    const allMembers = rotationSchedules.map((r) => {
      const isOrdered = r.status === 'ordered' || orderedMemberIds.has(r.memberId)
      return {
        id: r.member.id,
        scheduleId: r.id,
        name: r.member.name,
        phone: r.member.phone,
        groupName: r.member.group?.name || '-',
        role: r.member.role,
        isOrdered,
        status: isOrdered ? 'ordered' : r.status,
      }
    })

    // Sort: unfulfilled first for easy follow-up, then by name
    allMembers.sort((a, b) => {
      if (a.isOrdered === b.isOrdered) {
        return a.name.localeCompare(b.name)
      }
      return a.isOrdered ? 1 : -1
    })

    const pendingMembers = allMembers.filter((m) => !m.isOrdered)

    const totalBilling = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const paidAmount = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const unpaidAmount = totalBilling - paidAmount
    const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length
    const unpaidCount = orders.length - paidCount

    // 5. Total active members
    const totalMembers = await prisma.member.count({ where: { isActive: true } })

    return NextResponse.json({
      hasCycle: true,
      allCycles,
      currentCycle: {
        id: currentCycle.id,
        label: currentCycle.label,
        periodStart: currentCycle.periodStart,
        orderDeadline: currentCycle.orderDeadline,
        deliveryDate: currentCycle.deliveryDate,
        status: currentCycle.status,
        notes: currentCycle.notes,
      },
      targets: targetStats,
      rotation: {
        scheduledCount,
        orderedCount,
        percentage: scheduledCount > 0 ? Math.round((orderedCount / scheduledCount) * 100) : 0,
        pendingMembers,
        members: allMembers,
      },
      payments: {
        totalOrders: orders.length,
        totalBilling,
        paidAmount,
        unpaidAmount,
        paidCount,
        unpaidCount,
      },
      recentOrders: orders.slice(0, 5).map((o) => ({
        id: o.id,
        memberName: o.member.name,
        groupName: o.member.group?.name || '-',
        totalAmount: Number(o.totalAmount),
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt,
        itemCount: o.items.length,
      })),
      totalMembers,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
