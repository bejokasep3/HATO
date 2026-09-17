import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycleId')

    if (!cycleId) {
      // Return list of all cycles with inventory status
      const cycles = await prisma.cycle.findMany({
        orderBy: { periodStart: 'desc' },
        include: {
          goodsReceipt: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
          orders: {
            include: {
              items: true,
            },
          },
        },
      })

      const formatted = cycles.map((c) => {
        const totalOrderedRevenue = c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
        const receipt = c.goodsReceipt
        const totalPurchaseCost = receipt
          ? receipt.items.reduce(
              (sum, it) => sum + Number(it.purchasePrice) * Number(it.receivedQty),
              0
            )
          : 0

        return {
          cycleId: c.id,
          cycleLabel: c.label,
          status: c.status,
          periodStart: c.periodStart,
          deliveryDate: c.deliveryDate,
          hasReceipt: !!receipt,
          receiptStatus: receipt?.status || 'none',
          totalOrders: c.orders.length,
          totalRevenue: totalOrderedRevenue,
          totalCost: totalPurchaseCost,
          grossMargin: totalOrderedRevenue - totalPurchaseCost,
        }
      })

      return NextResponse.json(formatted)
    }

    // Specific cycle inventory detail
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        goodsReceipt: {
          include: {
            items: {
              include: { product: true },
              orderBy: { product: { sortOrder: 'asc' } },
            },
          },
        },
        orders: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    })

    if (!cycle) {
      return NextResponse.json({ error: 'Siklus tidak ditemukan' }, { status: 404 })
    }

    // Calculate aggregated order demand per product for this cycle
    const orderedMap = new Map<string, { product: any; totalOrderedQty: number; totalRevenue: number }>()

    for (const order of cycle.orders) {
      for (const item of order.items) {
        const existing = orderedMap.get(item.productId) || {
          product: item.product,
          totalOrderedQty: 0,
          totalRevenue: 0,
        }
        existing.totalOrderedQty += Number(item.quantity)
        existing.totalRevenue += Number(item.subtotal)
        orderedMap.set(item.productId, existing)
      }
    }

    // Also include active products that might not have orders but have weekly prices
    const weeklyPrices = await prisma.weeklyPrice.findMany({
      where: { cycleId },
      include: { product: true },
      orderBy: { product: { sortOrder: 'asc' } },
    })

    for (const wp of weeklyPrices) {
      if (!orderedMap.has(wp.productId)) {
        orderedMap.set(wp.productId, {
          product: wp.product,
          totalOrderedQty: 0,
          totalRevenue: 0,
        })
      }
    }

    const receipt = cycle.goodsReceipt

    // If receipt already exists, combine with ordered data
    const items = Array.from(orderedMap.entries()).map(([pId, data]) => {
      const receiptItem = receipt?.items.find((it) => it.productId === pId)
      const orderedQty = receiptItem ? Number(receiptItem.orderedQty) : data.totalOrderedQty
      const receivedQty = receiptItem ? Number(receiptItem.receivedQty) : data.totalOrderedQty
      const damagedQty = receiptItem ? Number(receiptItem.damagedQty) : 0
      const purchasePrice = receiptItem ? Number(receiptItem.purchasePrice) : 0
      const notes = receiptItem?.notes || ''
      const totalCost = purchasePrice * receivedQty
      const difference = receivedQty - orderedQty

      return {
        productId: pId,
        productName: data.product.name,
        unit: data.product.unit,
        category: data.product.category,
        isTarget: data.product.isTarget,
        orderedQty,
        receivedQty,
        damagedQty,
        purchasePrice,
        totalCost,
        revenue: data.totalRevenue,
        margin: data.totalRevenue - totalCost,
        difference,
        notes,
      }
    })

    const totalOrderedQty = items.reduce((sum, it) => sum + it.orderedQty, 0)
    const totalReceivedQty = items.reduce((sum, it) => sum + it.receivedQty, 0)
    const totalDamagedQty = items.reduce((sum, it) => sum + it.damagedQty, 0)
    const totalPurchaseCost = items.reduce((sum, it) => sum + it.totalCost, 0)
    const totalRevenue = items.reduce((sum, it) => sum + it.revenue, 0)
    const grossMargin = totalRevenue - totalPurchaseCost
    const marginPercentage = totalRevenue > 0 ? Math.round((grossMargin / totalRevenue) * 100) : 0

    return NextResponse.json({
      cycle: {
        id: cycle.id,
        label: cycle.label,
        status: cycle.status,
        periodStart: cycle.periodStart,
        deliveryDate: cycle.deliveryDate,
      },
      receipt: receipt
        ? {
            id: receipt.id,
            status: receipt.status,
            receivedAt: receipt.receivedAt,
            supplierNote: receipt.supplierNote,
            createdAt: receipt.createdAt,
            updatedAt: receipt.updatedAt,
          }
        : null,
      summary: {
        totalOrderedQty,
        totalReceivedQty,
        totalDamagedQty,
        totalPurchaseCost,
        totalRevenue,
        grossMargin,
        marginPercentage,
        hasDiscrepancy: items.some((it) => it.difference !== 0 || it.damagedQty > 0),
      },
      items,
    })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}

const saveInventorySchema = z.object({
  cycleId: z.string().uuid(),
  supplierNote: z.string().nullable().optional(),
  receivedAt: z.string().optional(),
  status: z.enum(['draft', 'confirmed']).default('draft'),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      orderedQty: z.number().nonnegative(),
      receivedQty: z.number().nonnegative(),
      damagedQty: z.number().nonnegative().default(0),
      purchasePrice: z.number().nonnegative().default(0),
      notes: z.string().nullable().optional(),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = saveInventorySchema.parse(body)

    const cycle = await prisma.cycle.findUnique({
      where: { id: validated.cycleId },
    })

    if (!cycle) {
      return NextResponse.json({ error: 'Siklus tidak ditemukan' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert GoodsReceipt header
      const receipt = await tx.goodsReceipt.upsert({
        where: { cycleId: validated.cycleId },
        update: {
          supplierNote: validated.supplierNote,
          status: validated.status,
          receivedAt: validated.receivedAt ? new Date(validated.receivedAt) : undefined,
        },
        create: {
          cycleId: validated.cycleId,
          supplierNote: validated.supplierNote,
          status: validated.status,
          receivedAt: validated.receivedAt ? new Date(validated.receivedAt) : new Date(),
        },
      })

      // 2. Delete existing items and re-create for clean state
      await tx.goodsReceiptItem.deleteMany({
        where: { goodsReceiptId: receipt.id },
      })

      if (validated.items.length > 0) {
        await tx.goodsReceiptItem.createMany({
          data: validated.items.map((it) => ({
            goodsReceiptId: receipt.id,
            productId: it.productId,
            orderedQty: it.orderedQty,
            receivedQty: it.receivedQty,
            damagedQty: it.damagedQty,
            purchasePrice: it.purchasePrice,
            notes: it.notes || null,
          })),
        })
      }

      return receipt
    })

    return NextResponse.json({ message: 'Penerimaan barang berhasil disimpan', receipt: result }, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error saving inventory receipt:', error)
    return NextResponse.json({ error: error.message || 'Failed to save inventory receipt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { cycleId, status, supplierNote } = body

    if (!cycleId) {
      return NextResponse.json({ error: 'Cycle ID is required' }, { status: 400 })
    }

    const updated = await prisma.goodsReceipt.update({
      where: { cycleId },
      data: {
        status: status || undefined,
        supplierNote: supplierNote !== undefined ? supplierNote : undefined,
      },
    })

    return NextResponse.json({ message: 'Status penerimaan barang diperbarui', receipt: updated })
  } catch (error: any) {
    console.error('Error updating inventory status:', error)
    return NextResponse.json({ error: error.message || 'Failed to update inventory status' }, { status: 500 })
  }
}
