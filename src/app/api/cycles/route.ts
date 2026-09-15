import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const cycleSchema = z.object({
  label: z.string().min(2, 'Label siklus minimal 2 karakter'),
  periodStart: z.string().transform((str) => new Date(str)),
  orderDeadline: z.string().transform((str) => new Date(str)),
  deliveryDate: z.string().transform((str) => new Date(str)),
  status: z.enum(['draft', 'open', 'closed', 'delivered', 'completed']).default('draft'),
  notes: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const cycles = await prisma.cycle.findMany({
      include: {
        _count: {
          select: {
            orders: true,
            rotationSchedules: true,
          },
        },
        orders: {
          select: {
            totalAmount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { periodStart: 'desc' },
    })

    const formatted = cycles.map((c) => {
      const totalAmount = c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
      const paidAmount = c.orders
        .filter((o) => o.paymentStatus === 'paid')
        .reduce((sum, o) => sum + Number(o.totalAmount), 0)

      return {
        id: c.id,
        label: c.label,
        periodStart: c.periodStart,
        orderDeadline: c.orderDeadline,
        deliveryDate: c.deliveryDate,
        status: c.status,
        notes: c.notes,
        totalOrders: c._count.orders,
        totalRotation: c._count.rotationSchedules,
        totalAmount,
        paidAmount,
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching cycles:', error)
    return NextResponse.json({ error: 'Failed to fetch cycles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = cycleSchema.parse(body)

    if (validated.periodStart > validated.orderDeadline) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak boleh melebihi deadline pesanan.' },
        { status: 400 }
      )
    }
    if (validated.orderDeadline > validated.deliveryDate) {
      return NextResponse.json(
        { error: 'Deadline pesanan tidak boleh melebihi tanggal pengiriman.' },
        { status: 400 }
      )
    }

    const cycle = await prisma.cycle.create({
      data: validated,
    })

    // Pre-populate weekly prices from the most recent cycle
    const previousCycle = await prisma.cycle.findFirst({
      where: { id: { not: cycle.id } },
      orderBy: { periodStart: 'desc' },
      include: { weeklyPrices: true },
    })

    if (previousCycle && previousCycle.weeklyPrices.length > 0) {
      for (const wp of previousCycle.weeklyPrices) {
        await prisma.weeklyPrice.create({
          data: {
            cycleId: cycle.id,
            productId: wp.productId,
            price: wp.price,
          },
        })
      }
    } else {
      // Default to product active list with 0 price if no previous cycle
      const activeProducts = await prisma.product.findMany({ where: { isActive: true } })
      for (const prod of activeProducts) {
        await prisma.weeklyPrice.create({
          data: {
            cycleId: cycle.id,
            productId: prod.id,
            price: 0,
          },
        })
      }
    }

    return NextResponse.json(cycle, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating cycle:', error)
    return NextResponse.json({ error: 'Failed to create cycle' }, { status: 500 })
  }
}
