import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createOrderSchema = z.object({
  cycleId: z.string().uuid('ID siklus tidak valid'),
  memberId: z.string().uuid('ID anggota tidak valid'),
  notes: z.string().nullable().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().positive('Jumlah harus lebih dari 0'),
      priceType: z.enum(['consumer', 'trader']).default('consumer'),
    })
  ).min(1, 'Minimal 1 produk harus dipesan'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycleId')
    const memberId = searchParams.get('memberId')
    const paymentStatus = searchParams.get('paymentStatus')
    const orderStatus = searchParams.get('orderStatus')

    const where: any = {}
    if (cycleId) where.cycleId = cycleId
    if (memberId) where.memberId = memberId
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (orderStatus) where.orderStatus = orderStatus

    const orders = await prisma.order.findMany({
      where,
      include: {
        cycle: { select: { id: true, label: true, status: true } },
        member: {
          include: { group: true },
        },
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createOrderSchema.parse(body)

    // Check if order already exists for this member in this cycle
    const existingOrder = await prisma.order.findUnique({
      where: {
        cycleId_memberId: {
          cycleId: validated.cycleId,
          memberId: validated.memberId,
        },
      },
      include: {
        cycle: { select: { label: true } },
        member: { select: { name: true } },
      },
    })

    if (existingOrder) {
      return NextResponse.json(
        {
          error: `Anggota ${existingOrder.member?.name || 'ini'} sudah memiliki pesanan di siklus ${existingOrder.cycle?.label || 'ini'}.`,
        },
        { status: 400 }
      )
    }

    // Get weekly prices for this cycle
    const weeklyPrices = await prisma.weeklyPrice.findMany({
      where: { cycleId: validated.cycleId },
    })

    const priceMap = new Map<string, { consumer: number; trader: number }>()
    weeklyPrices.forEach((wp) => {
      const consumer = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
      const trader = wp.traderPrice !== null ? Number(wp.traderPrice) : consumer
      priceMap.set(wp.productId, { consumer, trader })
    })

    // Calculate item prices and total
    let totalAmount = 0
    const itemsToCreate = validated.items.map((item) => {
      const priceObj = priceMap.get(item.productId) || { consumer: 0, trader: 0 }
      const unitPrice = item.priceType === 'trader' ? priceObj.trader : priceObj.consumer
      const subtotal = unitPrice * item.quantity
      totalAmount += subtotal
      return {
        productId: item.productId,
        priceType: item.priceType,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      }
    })

    // Execute in transaction
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          cycleId: validated.cycleId,
          memberId: validated.memberId,
          totalAmount,
          notes: validated.notes,
          paymentStatus: 'unpaid',
          orderStatus: 'pending',
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          member: { include: { group: true } },
          items: { include: { product: true } },
        },
      })

      // Update rotation status if exists
      await tx.rotationSchedule.updateMany({
        where: {
          cycleId: validated.cycleId,
          memberId: validated.memberId,
        },
        data: { status: 'ordered' },
      })

      return createdOrder
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, paymentStatus, orderStatus, notes, items } = body

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus
      updateData.paidAt = paymentStatus === 'paid' ? new Date() : null
    }
    if (orderStatus) {
      updateData.orderStatus = orderStatus
    }
    if (notes !== undefined) {
      updateData.notes = notes
    }

    // If items are provided, recalculate total and replace items
    if (items && Array.isArray(items)) {
      const existingOrder = await prisma.order.findUnique({
        where: { id },
        select: { cycleId: true },
      })
      if (!existingOrder) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
      }

      // Fetch weekly prices for this cycle
      const weeklyPrices = await prisma.weeklyPrice.findMany({
        where: { cycleId: existingOrder.cycleId },
      })
      const priceMap = new Map<string, { consumer: number; trader: number }>()
      weeklyPrices.forEach((wp) => {
        const consumer = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
        const trader = wp.traderPrice !== null ? Number(wp.traderPrice) : consumer
        priceMap.set(wp.productId, { consumer, trader })
      })

      let totalAmount = 0
      const itemsToCreate = items.map((item: any) => {
        const priceObj = priceMap.get(item.productId) || { consumer: 0, trader: 0 }
        const unitPrice = item.priceType === 'trader' ? priceObj.trader : priceObj.consumer
        const qty = Number(item.quantity) || 0
        const subtotal = unitPrice * qty
        totalAmount += subtotal
        return {
          orderId: id,
          productId: item.productId,
          priceType: item.priceType || 'consumer',
          quantity: qty,
          unitPrice,
          subtotal,
        }
      })

      updateData.totalAmount = totalAmount

      const updated = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } })
        await tx.orderItem.createMany({ data: itemsToCreate })
        return await tx.order.update({
          where: { id },
          data: updateData,
          include: {
            member: { include: { group: true } },
            items: { include: { product: true } },
          },
        })
      })

      return NextResponse.json(updated)
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        member: { include: { group: true } },
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.delete({ where: { id } })
      // Revert rotation status back to scheduled
      await tx.rotationSchedule.updateMany({
        where: {
          cycleId: order.cycleId,
          memberId: order.memberId,
        },
        data: { status: 'scheduled' },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
