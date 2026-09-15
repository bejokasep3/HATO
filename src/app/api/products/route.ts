import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(2, 'Nama produk minimal 2 karakter'),
  unit: z.string().min(1, 'Satuan harus diisi'),
  isTarget: z.boolean().default(false),
  targetQuantity: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  consumerPrice: z.number().min(0).nullable().optional(),
  traderPrice: z.number().min(0).nullable().optional(),
  price: z.number().min(0).nullable().optional(), // fallback
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    // Find current active cycle
    const currentCycle = await prisma.cycle.findFirst({
      where: { status: { in: ['open', 'draft'] } },
      orderBy: { periodStart: 'desc' },
    })

    const products = await prisma.product.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        _count: {
          select: { orderItems: true },
        },
        weeklyPrices: currentCycle
          ? {
              where: { cycleId: currentCycle.id },
              take: 1,
            }
          : false,
      },
      orderBy: [{ isTarget: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    const formatted = products.map((p) => {
      const wp = p.weeklyPrices && p.weeklyPrices[0] ? p.weeklyPrices[0] : null
      const consumerPrice = wp?.consumerPrice !== null && wp?.consumerPrice !== undefined
        ? Number(wp.consumerPrice)
        : wp?.price !== undefined
        ? Number(wp.price)
        : null

      const traderPrice = wp?.traderPrice !== null && wp?.traderPrice !== undefined
        ? Number(wp.traderPrice)
        : consumerPrice

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        isTarget: p.isTarget,
        targetQuantity: p.targetQuantity ? Number(p.targetQuantity) : null,
        category: p.category,
        sortOrder: p.sortOrder,
        isActive: p.isActive,
        _count: p._count,
        consumerPrice,
        traderPrice,
        currentPrice: consumerPrice,
        activeCycleId: currentCycle?.id || null,
        activeCycleLabel: currentCycle?.label || null,
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { consumerPrice, traderPrice, price, ...productData } = body
    const validated = productSchema.parse({ ...productData, consumerPrice, traderPrice, price })

    const finalConsumerPrice = validated.consumerPrice ?? validated.price ?? null
    const finalTraderPrice = validated.traderPrice ?? finalConsumerPrice

    const product = await prisma.product.create({
      data: {
        name: validated.name,
        unit: validated.unit,
        isTarget: validated.isTarget,
        targetQuantity: validated.targetQuantity,
        category: validated.category,
        sortOrder: validated.sortOrder,
        isActive: validated.isActive,
      },
    })

    if (finalConsumerPrice !== null) {
      const activeCycle = await prisma.cycle.findFirst({
        where: { status: { in: ['open', 'draft'] } },
        orderBy: { periodStart: 'desc' },
      })
      if (activeCycle) {
        await prisma.weeklyPrice.create({
          data: {
            cycleId: activeCycle.id,
            productId: product.id,
            price: Number(finalConsumerPrice),
            consumerPrice: Number(finalConsumerPrice),
            traderPrice: Number(finalTraderPrice ?? finalConsumerPrice),
          },
        })
      }
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, consumerPrice, traderPrice, price, ...data } = body

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
    })

    const finalConsumerPrice = consumerPrice !== undefined ? consumerPrice : price
    const finalTraderPrice = traderPrice !== undefined ? traderPrice : finalConsumerPrice

    if (finalConsumerPrice !== undefined && finalConsumerPrice !== null && finalConsumerPrice !== '') {
      const activeCycle = await prisma.cycle.findFirst({
        where: { status: { in: ['open', 'draft'] } },
        orderBy: { periodStart: 'desc' },
      })
      if (activeCycle) {
        await prisma.weeklyPrice.upsert({
          where: {
            cycleId_productId: {
              cycleId: activeCycle.id,
              productId: id,
            },
          },
          update: {
            price: Number(finalConsumerPrice),
            consumerPrice: Number(finalConsumerPrice),
            traderPrice: Number(finalTraderPrice ?? finalConsumerPrice),
          },
          create: {
            cycleId: activeCycle.id,
            productId: id,
            price: Number(finalConsumerPrice),
            consumerPrice: Number(finalConsumerPrice),
            traderPrice: Number(finalTraderPrice ?? finalConsumerPrice),
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: id },
    })

    if (orderItemsCount > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        message: 'Produk telah dinonaktifkan karena sudah terdapat riwayat pesanan.',
        softDeleted: true,
      })
    }

    await prisma.weeklyPrice.deleteMany({
      where: { productId: id },
    })
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({
      message: 'Produk berhasil dihapus permanen.',
      softDeleted: false,
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
