import { type PrismaClient } from '@prisma/client'
import { availability as calculate } from '../domain/availability'
import { formatScaled, parseScaled } from '../domain/money'
import { ServiceError, type Tx } from './mutation'

type Db = PrismaClient | Tx

export async function getCycleAvailability(db: Db, cycleId: string) {
  const cycle = await db.cycle.findUnique({
    where: { id: cycleId },
    include: {
      weeklyPrices: { include: { product: true } },
      supplierRecap: { include: { items: true } },
      goodsReceipt: { include: { items: { include: { product: true } } } },
      orders: { where: { cancelledAt: null }, include: { items: { include: { product: true } } } },
    },
  })
  if (!cycle) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')
  const historical = cycle.rulesVersion !== 2

  const allocated = new Map<string, bigint>()
  const shipped = new Map<string, bigint>()
  for (const order of cycle.orders) for (const item of order.items) {
    const qty = parseScaled(item.quantity.toFixed(2), 2, 8)
    allocated.set(item.productId, (allocated.get(item.productId) ?? 0n) + qty)
    if (order.orderStatus === 'shipped' || order.orderStatus === 'delivered') {
      shipped.set(item.productId, (shipped.get(item.productId) ?? 0n) + qty)
    }
  }

  const recap = new Map(cycle.supplierRecap?.items.map((item) => [item.productId, item.quantity.toFixed(2)]) ?? [])
  const received = new Map(cycle.goodsReceipt?.items.map((item) => [item.productId, item.receivedQty.minus(item.damagedQty).toFixed(2)]) ?? [])
  const source = historical ? 'unknown' : cycle.goodsReceipt?.status === 'confirmed' ? 'received' : cycle.supplierRecap ? 'planned' : 'unknown'
  const products = new Map(cycle.weeklyPrices.map((price) => [price.productId, { productId: price.productId, productName: price.product.name, unit: price.unitSnapshot ?? price.product.unit }]))
  if (historical) for (const order of cycle.orders) for (const item of order.items) {
    if (!products.has(item.productId)) products.set(item.productId, { productId: item.productId, productName: item.product.name, unit: item.product.unit })
  }
  if (historical) for (const item of cycle.goodsReceipt?.items ?? []) {
    if (!products.has(item.productId)) products.set(item.productId, { productId: item.productId, productName: item.product.name, unit: item.product.unit })
  }
  const items = [...products.values()].map((product) => {
    const allocatedQty = formatScaled(allocated.get(product.productId) ?? 0n)
    const shippedQty = formatScaled(shipped.get(product.productId) ?? 0n)
    const capacity = source === 'received' ? (received.get(product.productId) ?? '0.00') : source === 'planned' ? (recap.get(product.productId) ?? '0.00') : null
    const balance = source === 'unknown' || capacity === null ? null : calculate(capacity, allocatedQty, shippedQty, source)
    return {
      ...product,
      capacity,
      allocated: allocatedQty,
      shipped: shippedQty,
      availableToOrder: balance?.availableToOrder ?? null,
      shortage: balance?.shortage ?? null,
      physicalRemaining: balance?.physicalRemaining ?? null,
      reserved: balance?.reserved ?? null,
      source,
    }
  })
  return { cycleId, cycleVersion: cycle.version, historical, items }
}
