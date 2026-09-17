import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'targets'

    // Fetch all cycles with related data
    const cycles = await prisma.cycle.findMany({
      orderBy: { periodStart: 'asc' },
      include: {
        orders: {
          include: {
            member: { include: { group: true } },
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

    if (type === 'targets') {
      let prevChickenLeftover = 0
      let prevTofuLeftover = 0

      const cycleTargetReports = cycles.map((c) => {
        const allItems = c.orders.flatMap((o) => o.items)

        // Chicken Target Group: Karkas, Recah, Gebrus
        const chickenKarkas = allItems
          .filter((it) => it.product.name.toLowerCase().includes('karkas'))
          .reduce((sum, it) => sum + Number(it.quantity), 0)
        const chickenRecah = allItems
          .filter((it) => it.product.name.toLowerCase().includes('recah'))
          .reduce((sum, it) => sum + Number(it.quantity), 0)
        const chickenGebrus = allItems
          .filter((it) => it.product.name.toLowerCase().includes('gebrus'))
          .reduce((sum, it) => sum + Number(it.quantity), 0)

        const chickenSold = chickenKarkas + chickenRecah + chickenGebrus
        const chickenTarget = 20
        const chickenBeginningStock = prevChickenLeftover

        // Barang Masuk dari Supplier: 20 kg targetan atau mengikuti pesanan jika melebihi target
        let chickenGoodsIn = Math.max(chickenTarget, chickenSold)
        if (c.goodsReceipt) {
          const receiptChicken = c.goodsReceipt.items
            .filter((it) => {
              const n = it.product.name.toLowerCase()
              return n.includes('karkas') || n.includes('recah') || n.includes('gebrus')
            })
            .reduce((sum, it) => sum + Number(it.receivedQty), 0)
          if (receiptChicken > 0) chickenGoodsIn = receiptChicken
        }

        const chickenAvailable = chickenBeginningStock + chickenGoodsIn
        const chickenEndingStock = Math.max(0, chickenAvailable - chickenSold)
        const chickenIsMet = chickenSold >= chickenTarget
        const chickenShortfall = Math.max(0, chickenTarget - chickenSold)
        const chickenPercentage = Math.round((chickenSold / chickenTarget) * 100)

        prevChickenLeftover = chickenEndingStock

        // Tofu Target Group: Tahu Kuning & Tahu Putih
        const tofuKuning = allItems
          .filter((it) => it.product.name.toLowerCase().includes('tahu') && it.product.name.toLowerCase().includes('kuning'))
          .reduce((sum, it) => sum + Number(it.quantity), 0)
        const tofuPutih = allItems
          .filter((it) => it.product.name.toLowerCase().includes('tahu') && it.product.name.toLowerCase().includes('putih'))
          .reduce((sum, it) => sum + Number(it.quantity), 0)
        const tofuSold = (tofuKuning + tofuPutih) > 0 
          ? (tofuKuning + tofuPutih)
          : allItems
              .filter((it) => it.product.name.toLowerCase().includes('tahu'))
              .reduce((sum, it) => sum + Number(it.quantity), 0)
        const tofuTarget = 20
        const tofuBeginningStock = prevTofuLeftover

        let tofuGoodsIn = Math.max(tofuTarget, tofuSold)
        if (c.goodsReceipt) {
          const receiptTofu = c.goodsReceipt.items
            .filter((it) => it.product.name.toLowerCase().includes('tahu'))
            .reduce((sum, it) => sum + Number(it.receivedQty), 0)
          if (receiptTofu > 0) tofuGoodsIn = receiptTofu
        }

        const tofuAvailable = tofuBeginningStock + tofuGoodsIn
        const tofuEndingStock = Math.max(0, tofuAvailable - tofuSold)
        const tofuIsMet = tofuSold >= tofuTarget
        const tofuShortfall = Math.max(0, tofuTarget - tofuSold)
        const tofuPercentage = Math.round((tofuSold / tofuTarget) * 100)

        prevTofuLeftover = tofuEndingStock

        return {
          cycleId: c.id,
          cycleLabel: c.label,
          status: c.status,
          periodStart: c.periodStart,
          deliveryDate: c.deliveryDate,
          chicken: {
            target: chickenTarget,
            sold: chickenSold,
            beginningStock: chickenBeginningStock,
            goodsIn: chickenGoodsIn,
            available: chickenAvailable,
            endingStock: chickenEndingStock,
            isMet: chickenIsMet,
            shortfall: chickenShortfall,
            percentage: chickenPercentage,
            breakdown: {
              karkas: chickenKarkas,
              recah: chickenRecah,
              gebrus: chickenGebrus,
            },
          },
          tofu: {
            target: tofuTarget,
            sold: tofuSold,
            beginningStock: tofuBeginningStock,
            goodsIn: tofuGoodsIn,
            available: tofuAvailable,
            endingStock: tofuEndingStock,
            isMet: tofuIsMet,
            shortfall: tofuShortfall,
            percentage: tofuPercentage,
            breakdown: {
              kuning: tofuKuning,
              putih: tofuPutih,
            },
          },
        }
      })

      const totalCycles = cycleTargetReports.length
      const chickenMetCount = cycleTargetReports.filter((r) => r.chicken.isMet).length
      const tofuMetCount = cycleTargetReports.filter((r) => r.tofu.isMet).length
      const latestReport = cycleTargetReports[cycleTargetReports.length - 1]

      const chartData = cycleTargetReports.map((r) => ({
        name: r.cycleLabel,
        'Ayam Terjual': r.chicken.sold,
        'Target Ayam': r.chicken.target,
        'Sisa Ayam': r.chicken.endingStock,
        'Tahu Terjual': r.tofu.sold,
        'Target Tahu': r.tofu.target,
        'Sisa Tahu': r.tofu.endingStock,
      }))

      return NextResponse.json({
        summary: {
          totalCycles,
          chickenSuccessRate: totalCycles > 0 ? Math.round((chickenMetCount / totalCycles) * 100) : 0,
          tofuSuccessRate: totalCycles > 0 ? Math.round((tofuMetCount / totalCycles) * 100) : 0,
          currentChickenLeftover: latestReport?.chicken.endingStock || 0,
          currentTofuLeftover: latestReport?.tofu.endingStock || 0,
          chickenMetCount,
          tofuMetCount,
        },
        cycleReports: cycleTargetReports,
        chartData,
      })
    }

    if (type === 'financial') {
      const cycleReports = cycles.map((c) => {
        const totalRevenue = c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
        const paidRevenue = c.orders
          .filter((o) => o.paymentStatus === 'paid')
          .reduce((sum, o) => sum + Number(o.totalAmount), 0)
        const unpaidRevenue = totalRevenue - paidRevenue

        // Calculate Cost of Goods Sold (COGS) from goodsReceipt
        const receipt = c.goodsReceipt
        const totalCost = receipt
          ? receipt.items.reduce(
              (sum, it) => sum + Number(it.purchasePrice) * Number(it.receivedQty),
              0
            )
          : 0

        const grossMargin = totalRevenue - totalCost
        const marginPct = totalRevenue > 0 ? Math.round((grossMargin / totalRevenue) * 100) : 0
        const collectionRate = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0

        return {
          cycleId: c.id,
          cycleLabel: c.label,
          status: c.status,
          periodStart: c.periodStart,
          deliveryDate: c.deliveryDate,
          orderCount: c.orders.length,
          totalRevenue,
          paidRevenue,
          unpaidRevenue,
          totalCost,
          grossMargin,
          marginPct,
          collectionRate,
          hasReceipt: !!receipt,
        }
      })

      // Overall totals
      const totalRevenue = cycleReports.reduce((sum, c) => sum + c.totalRevenue, 0)
      const totalPaid = cycleReports.reduce((sum, c) => sum + c.paidRevenue, 0)
      const totalUnpaid = cycleReports.reduce((sum, c) => sum + c.unpaidRevenue, 0)
      const totalCost = cycleReports.reduce((sum, c) => sum + c.totalCost, 0)
      const totalGrossMargin = totalRevenue - totalCost
      const overallMarginPct = totalRevenue > 0 ? Math.round((totalGrossMargin / totalRevenue) * 100) : 0
      const overallCollectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0

      // Trend data for chart
      const chartData = cycleReports.map((c) => ({
        name: c.cycleLabel.replace(' - ', '\n'),
        shortLabel: c.cycleLabel,
        Pendapatan: c.totalRevenue,
        Modal: c.totalCost,
        Margin: c.grossMargin,
        Terbayar: c.paidRevenue,
        Piutang: c.unpaidRevenue,
      }))

      return NextResponse.json({
        summary: {
          totalRevenue,
          totalPaid,
          totalUnpaid,
          totalCost,
          totalGrossMargin,
          overallMarginPct,
          overallCollectionRate,
          totalCycles: cycles.length,
        },
        cycles: cycleReports,
        chartData,
      })
    }

    if (type === 'commodity') {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: {
          orderItems: {
            include: {
              order: {
                include: { cycle: true },
              },
            },
          },
          goodsReceiptItems: {
            include: {
              goodsReceipt: {
                include: { cycle: true },
              },
            },
          },
        },
        orderBy: [{ isTarget: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      })

      const commodityReports = products.map((p) => {
        const totalOrderedQty = p.orderItems.reduce((sum, it) => sum + Number(it.quantity), 0)
        const totalRevenue = p.orderItems.reduce((sum, it) => sum + Number(it.subtotal), 0)

        const totalReceivedQty = p.goodsReceiptItems.reduce(
          (sum, it) => sum + Number(it.receivedQty),
          0
        )
        const totalDamagedQty = p.goodsReceiptItems.reduce(
          (sum, it) => sum + Number(it.damagedQty),
          0
        )
        const totalCost = p.goodsReceiptItems.reduce(
          (sum, it) => sum + Number(it.purchasePrice) * Number(it.receivedQty),
          0
        )

        const grossProfit = totalRevenue - totalCost
        const avgSellingPrice = totalOrderedQty > 0 ? Math.round(totalRevenue / totalOrderedQty) : 0
        const avgPurchasePrice = totalReceivedQty > 0 ? Math.round(totalCost / totalReceivedQty) : 0
        const profitMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0

        // Cycle breakdown for this product
        const cycleBreakdown = cycles.map((c) => {
          const items = p.orderItems.filter((it) => it.order.cycleId === c.id)
          const qty = items.reduce((sum, it) => sum + Number(it.quantity), 0)
          const val = items.reduce((sum, it) => sum + Number(it.subtotal), 0)
          return {
            cycleId: c.id,
            cycleLabel: c.label,
            quantity: qty,
            revenue: val,
          }
        })

        return {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          category: p.category,
          isTarget: p.isTarget,
          targetQuantity: p.targetQuantity ? Number(p.targetQuantity) : null,
          totalOrderedQty,
          totalReceivedQty,
          totalDamagedQty,
          totalRevenue,
          totalCost,
          grossProfit,
          profitMarginPct,
          avgSellingPrice,
          avgPurchasePrice,
          orderCount: p.orderItems.length,
          cycleBreakdown,
        }
      })

      // Top products by revenue
      const topByRevenue = [...commodityReports].sort((a, b) => b.totalRevenue - a.totalRevenue)

      // Chart: volume comparison for top commodities
      const chartData = commodityReports.slice(0, 6).map((p) => ({
        name: p.name,
        Dipesan: p.totalOrderedQty,
        Diterima: p.totalReceivedQty,
        Rusak: p.totalDamagedQty,
      }))

      return NextResponse.json({
        commodities: commodityReports,
        topByRevenue,
        chartData,
      })
    }

    if (type === 'member') {
      const members = await prisma.member.findMany({
        where: { isActive: true },
        include: {
          group: true,
          orders: {
            include: {
              cycle: true,
            },
          },
        },
      })

      const memberStats = members.map((m) => {
        const orderCount = m.orders.length
        const totalSpend = m.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
        const paidCount = m.orders.filter((o) => o.paymentStatus === 'paid').length
        const unpaidCount = orderCount - paidCount
        const unpaidAmount = m.orders
          .filter((o) => o.paymentStatus !== 'paid')
          .reduce((sum, o) => sum + Number(o.totalAmount), 0)
        const paymentRate = orderCount > 0 ? Math.round((paidCount / orderCount) * 100) : 0

        return {
          memberId: m.id,
          name: m.name,
          phone: m.phone,
          groupName: m.group?.name || '-',
          role: m.role,
          orderCount,
          totalSpend,
          paidCount,
          unpaidCount,
          unpaidAmount,
          paymentRate,
          lastOrderDate: m.orders[0]?.createdAt || null,
        }
      })

      memberStats.sort((a, b) => b.totalSpend - a.totalSpend)

      // Group Performance
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
        const activeMembers = g.members.filter((m) => m.orders.length > 0).length
        const totalOrders = g.members.reduce((sum, m) => sum + m.orders.length, 0)
        const totalSpend = g.members.reduce(
          (sum, m) => sum + m.orders.reduce((s, o) => s + Number(o.totalAmount), 0),
          0
        )
        const participationRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0

        return {
          groupId: g.id,
          name: g.name,
          level: g.level,
          totalMembers,
          activeMembers,
          totalOrders,
          totalSpend,
          participationRate,
        }
      })

      return NextResponse.json({
        members: memberStats,
        groups: groupStats,
      })
    }

    if (type === 'receivable') {
      // Unpaid orders across all cycles
      const unpaidOrders = await prisma.order.findMany({
        where: { paymentStatus: 'unpaid' },
        include: {
          cycle: true,
          member: { include: { group: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      const now = new Date()
      const formattedOrders = unpaidOrders.map((o) => {
        const createdDate = new Date(o.createdAt)
        const daysOverdue = Math.max(
          0,
          Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
        )

        return {
          orderId: o.id,
          cycleId: o.cycleId,
          cycleLabel: o.cycle.label,
          memberId: o.memberId,
          memberName: o.member.name,
          memberPhone: o.member.phone,
          groupName: o.member.group?.name || '-',
          totalAmount: Number(o.totalAmount),
          orderStatus: o.orderStatus,
          createdAt: o.createdAt,
          daysOverdue,
          itemSummary: o.items.map((it) => `${it.product.name} (${Number(it.quantity)} ${it.product.unit})`).join(', '),
        }
      })

      // Aggregate unpaid by member
      const memberReceivablesMap = new Map<string, { member: any; totalUnpaid: number; ordersCount: number }>()

      for (const o of unpaidOrders) {
        const existing = memberReceivablesMap.get(o.memberId) || {
          member: o.member,
          totalUnpaid: 0,
          ordersCount: 0,
        }
        existing.totalUnpaid += Number(o.totalAmount)
        existing.ordersCount += 1
        memberReceivablesMap.set(o.memberId, existing)
      }

      const memberReceivables = Array.from(memberReceivablesMap.entries()).map(([mId, data]) => ({
        memberId: mId,
        memberName: data.member.name,
        memberPhone: data.member.phone,
        groupName: data.member.group?.name || '-',
        totalUnpaid: data.totalUnpaid,
        ordersCount: data.ordersCount,
      }))

      memberReceivables.sort((a, b) => b.totalUnpaid - a.totalUnpaid)

      const totalUnpaidAmount = formattedOrders.reduce((sum, o) => sum + o.totalAmount, 0)

      return NextResponse.json({
        summary: {
          totalUnpaidAmount,
          totalUnpaidOrders: formattedOrders.length,
          totalMembersWithDebt: memberReceivables.length,
        },
        orders: formattedOrders,
        members: memberReceivables,
      })
    }

    return NextResponse.json({ error: 'Tipe laporan tidak valid' }, { status: 400 })
  } catch (error) {
    console.error('Error generating reports:', error)
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 })
  }
}
