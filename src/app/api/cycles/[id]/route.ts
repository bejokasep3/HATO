import { withAdmin } from '@/lib/auth/admin'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Product } from '@prisma/client'
import { getCycleSummary } from '@/lib/services/operational-summary'
import { hasOperationalSchema } from '@/lib/services/schema-capabilities'
import { getLegacyCycleDetail } from '@/lib/services/legacy-readers'

async function GETImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!await hasOperationalSchema(prisma)) return NextResponse.json(await getLegacyCycleDetail(prisma, id))
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

    const orderedMemberIds = new Set(cycle.orders.filter((order) => !order.cancelledAt).map((o) => o.memberId))
    for (const r of cycle.rotationSchedules) {
      if (orderedMemberIds.has(r.memberId)) {
        r.status = 'ordered'
      }
    }

    // Calculate product breakdown & recap
    const productRecapMap = new Map<string, {
      product: Product
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

    for (const order of cycle.orders.filter((entry) => !entry.cancelledAt)) {
      for (const item of order.items) {
        const existing = productRecapMap.get(item.productId)
        if (existing) {
          const qty = Number(item.quantity)
          existing.totalQuantity += qty
          if (item.priceType === 'trader') {
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
        percentage: isTarget && targetQty > 0 ? Math.round((item.totalQuantity / targetQty) * 100) : 100,
      }
    })

    const operational = await getCycleSummary(prisma, id)
    return NextResponse.json({
      cycle: { ...cycle, evaluatedAt: operational.cycle.evaluatedAt, effectiveStatus: operational.cycle.effectiveStatus, calendarStatus: operational.cycle.calendarStatus },
      recap,
      operational,
    })
  } catch (error) {
    console.error('Error fetching cycle detail:', error)
    return NextResponse.json({ error: 'Failed to fetch cycle' }, { status: 500 })
  }
}

async function PATCHImpl(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  void _request
  void _context
  return NextResponse.json({ error: { code: 'CLIENT_UPDATE_REQUIRED', message: 'Gunakan aksi buka, tutup, atau ubah target siklus' }, requestId: crypto.randomUUID() }, { status: 409 })
}

export const GET = withAdmin(GETImpl)
export const PATCH = withAdmin(PATCHImpl)
