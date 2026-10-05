import { withAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
import { formatScaled, lineSubtotal, parseScaled, sumMoney } from '@/lib/domain/money'
import { mutationErrorResponse } from '@/lib/services/mutation'
import { NextResponse } from 'next/server'

async function GETImpl() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { goodsReceiptItems: { include: { goodsReceipt: { include: { cycle: true } } }, orderBy: { createdAt: 'desc' } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    const rows = products.map((product) => {
      const confirmed = product.goodsReceiptItems.filter((item) => item.goodsReceipt.status === 'confirmed')
      const receivedLines = confirmed.filter((item) => item.receivedQty.greaterThan(0))
      const latest = confirmed[0]
      return {
        productId: product.id, name: product.name, unit: product.unit,
        targetGroup: product.targetGroup,
        receiptsCount: confirmed.length,
        totalReceived: formatScaled(confirmed.reduce((sum, item) => sum + parseScaled(item.receivedQty.toFixed(2), 2, 8), 0n)),
        totalDamaged: formatScaled(confirmed.reduce((sum, item) => sum + parseScaled(item.damagedQty.toFixed(2), 2, 8), 0n)),
        purchaseValue: receivedLines.every((item) => item.purchasePrice.greaterThan(0))
          ? sumMoney(receivedLines.map((item) => lineSubtotal(item.purchasePrice.toFixed(2), item.receivedQty.toFixed(2))))
          : null,
        lastPurchasePrice: latest?.purchasePrice.toFixed(2) ?? null,
        lastReceivedDate: latest?.goodsReceipt.receivedAt.toISOString() ?? null,
        lastCycleLabel: latest?.goodsReceipt.cycle.label ?? null,
      }
    })
    return NextResponse.json({ summary: {
      confirmedPurchaseValue: sumMoney(rows.flatMap((row) => row.purchaseValue === null ? [] : [row.purchaseValue])),
      unknownPurchaseValueProductCount: rows.filter((row) => row.purchaseValue === null).length,
      totalProductsTracked: rows.length,
    }, products: rows })
  } catch (error) { return mutationErrorResponse(error) }
}

export const GET = withAdmin(GETImpl)
