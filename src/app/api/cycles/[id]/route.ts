import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cycle = await prisma.cycle.findUnique({
      where: { id },
      include: {
        weeklyPrices: {
          include: { product: true },
          orderBy: { product: { sortOrder: 'asc' } },
        },
        rotationSchedules: {
          include: {
            member: {
              include: { group: true },
            },
          },
        },
        orders: {
          include: {
            member: {
              include: { group: true },
            },
            items: {
              include: { product: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cycle) {
      return NextResponse.json({ error: 'Siklus tidak ditemukan' }, { status: 404 })
    }

    // Sync rotation status with existing orders in this cycle
    const orderedMemberIds = new Set(cycle.orders.map((o) => o.memberId))
    for (const r of cycle.rotationSchedules) {
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

    // Calculate product breakdown & recap
    const productRecapMap = new Map<string, {
      product: any
      totalQuantity: number
      consumerQuantity: number
      traderQuantity: number
      totalValue: number
      ordersCount: number
    }>()

    // Initialize all weekly priced products
    for (const wp of cycle.weeklyPrices) {
      productRecapMap.set(wp.productId, {
        product: wp.product,
        totalQuantity: 0,
        consumerQuantity: 0,
        traderQuantity: 0,
        totalValue: 0,
        ordersCount: 0,
      })
    }

    for (const order of cycle.orders) {
      for (const item of order.items) {
        const existing = productRecapMap.get(item.productId)
        if (existing) {
          const qty = Number(item.quantity)
          existing.totalQuantity += qty
          if ((item as any).priceType === 'trader') {
            existing.traderQuantity += qty
          } else {
            existing.consumerQuantity += qty
          }
          existing.totalValue += Number(item.subtotal)
          existing.ordersCount += 1
        }
      }
    }

    const recap = Array.from(productRecapMap.values()).map((item) => {
      const targetQty = Number(item.product.targetQuantity || 0)
      const isTarget = item.product.isTarget
      return {
        ...item,
        isMet: isTarget ? item.totalQuantity >= targetQty : true,
        percentage: isTarget && targetQty > 0 ? Math.min(100, Math.round((item.totalQuantity / targetQty) * 100)) : 100,
      }
    })

    return NextResponse.json({
      cycle,
      recap,
    })
  } catch (error) {
    console.error('Error fetching cycle detail:', error)
    return NextResponse.json({ error: 'Failed to fetch cycle' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: any = {}
    if (body.label !== undefined) updateData.label = body.label
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.periodStart !== undefined) updateData.periodStart = new Date(body.periodStart)
    if (body.orderDeadline !== undefined) updateData.orderDeadline = new Date(body.orderDeadline)
    if (body.deliveryDate !== undefined) updateData.deliveryDate = new Date(body.deliveryDate)

    const updated = await prisma.cycle.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating cycle:', error)
    return NextResponse.json({ error: 'Failed to update cycle' }, { status: 500 })
  }
}
