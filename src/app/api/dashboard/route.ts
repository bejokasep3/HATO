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

    // Default: prioritize 'open', then 'draft', then latest 'closed'
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

      if (!currentCycle) {
        currentCycle = await prisma.cycle.findFirst({
          where: { status: { in: ['draft', 'closed'] } },
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

    // 2. Get target products progress
    const targetProducts = await prisma.product.findMany({
      where: { isTarget: true, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { cycleId: currentCycle.id },
      },
      include: { product: true },
    })

    const targetStats = targetProducts.map((prod) => {
      const actualQty = orderItems
        .filter((item) => item.productId === prod.id)
        .reduce((sum, item) => sum + Number(item.quantity), 0)

      const targetQty = Number(prod.targetQuantity || 0)
      const percentage = targetQty > 0 ? Math.min(100, Math.round((actualQty / targetQty) * 100)) : 0

      return {
        id: prod.id,
        name: prod.name,
        unit: prod.unit,
        targetQuantity: targetQty,
        actualQuantity: actualQty,
        percentage,
        isMet: actualQty >= targetQty,
      }
    })

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
