import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        goodsReceiptItems: {
          include: {
            goodsReceipt: {
              include: { cycle: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ isTarget: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    const productStats = products.map((p) => {
      const items = p.goodsReceiptItems
      const totalReceived = items.reduce((sum, it) => sum + Number(it.receivedQty), 0)
      const totalDamaged = items.reduce((sum, it) => sum + Number(it.damagedQty), 0)
      const totalCostSpent = items.reduce(
        (sum, it) => sum + Number(it.purchasePrice) * Number(it.receivedQty),
        0
      )

      const latestItem = items[0]
      const lastPurchasePrice = latestItem ? Number(latestItem.purchasePrice) : 0
      const averagePurchasePrice = totalReceived > 0 ? Math.round(totalCostSpent / totalReceived) : 0

      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        category: p.category,
        isTarget: p.isTarget,
        receiptsCount: items.length,
        totalReceived,
        totalDamaged,
        lastPurchasePrice,
        averagePurchasePrice,
        totalCostSpent,
        lastReceivedDate: latestItem?.goodsReceipt?.receivedAt || null,
        lastCycleLabel: latestItem?.goodsReceipt?.cycle?.label || null,
      }
    })

    const totalSpend = productStats.reduce((sum, p) => sum + p.totalCostSpent, 0)
    const totalDamagedItems = productStats.reduce((sum, p) => sum + p.totalDamaged, 0)

    return NextResponse.json({
      summary: {
        totalSpend,
        totalDamagedItems,
        totalProductsTracked: products.length,
      },
      products: productStats,
    })
  } catch (error) {
    console.error('Error fetching inventory summary:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory summary' }, { status: 500 })
  }
}
