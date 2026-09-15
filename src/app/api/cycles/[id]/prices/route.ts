import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const prices = await prisma.weeklyPrice.findMany({
      where: { cycleId: id },
      include: { product: true },
      orderBy: { product: { sortOrder: 'asc' } },
    })

    const formatted = prices.map((wp) => {
      const consumer = wp.consumerPrice !== null ? Number(wp.consumerPrice) : Number(wp.price)
      const trader = wp.traderPrice !== null ? Number(wp.traderPrice) : consumer
      return {
        ...wp,
        price: Number(wp.price),
        consumerPrice: consumer,
        traderPrice: trader,
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching prices:', error)
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: {
      items: Array<{
        productId: string
        price?: number
        consumerPrice?: number
        traderPrice?: number
      }>
    } = await request.json()

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'Data items array is required' }, { status: 400 })
    }

    const updates = await prisma.$transaction(
      body.items.map((item) => {
        const consumer = item.consumerPrice ?? item.price ?? 0
        const trader = item.traderPrice ?? consumer
        return prisma.weeklyPrice.upsert({
          where: {
            cycleId_productId: {
              cycleId: id,
              productId: item.productId,
            },
          },
          update: {
            price: consumer,
            consumerPrice: consumer,
            traderPrice: trader,
          },
          create: {
            cycleId: id,
            productId: item.productId,
            price: consumer,
            consumerPrice: consumer,
            traderPrice: trader,
          },
        })
      })
    )

    return NextResponse.json(updates)
  } catch (error) {
    console.error('Error updating prices:', error)
    return NextResponse.json({ error: 'Failed to update prices' }, { status: 500 })
  }
}
