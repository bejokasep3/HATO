import { Prisma, type PrismaClient } from '@prisma/client'
import { formatScaled, parseScaled } from '../domain/money'
import { targetProgress, validateRecapAllocation } from '../domain/targets'
import { ServiceError, lockCycle, runIdempotent, type Tx } from './mutation'

type RecapInput = { productId: string; quantity: string }

async function loadRecapSource(db: PrismaClient | Tx, cycleId: string) {
  const cycle = await db.cycle.findUnique({
    where: { id: cycleId },
    include: {
      targets: true,
      weeklyPrices: { include: { product: true }, orderBy: { product: { sortOrder: 'asc' } } },
      orders: { where: { cancelledAt: null }, include: { items: true } },
      supplierRecap: { include: { items: true } },
    },
  })
  if (!cycle) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')
  if (cycle.rulesVersion !== 2 || !cycle.periodState) {
    throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Siklus lama belum direkonsiliasi')
  }
  if (cycle.targets.length !== 2) throw new ServiceError(422, 'TARGETS_REQUIRED', 'Target ayam dan tahu belum lengkap')

  const demandByProduct = new Map<string, bigint>()
  for (const order of cycle.orders) for (const item of order.items) {
    demandByProduct.set(item.productId, (demandByProduct.get(item.productId) ?? 0n) + parseScaled(item.quantity.toFixed(2), 2, 8))
  }
  const products = new Set(cycle.weeklyPrices.map((price) => price.productId))
  if ([...demandByProduct.keys()].some((id) => !products.has(id))) {
    throw new ServiceError(422, 'ORDER_PRODUCT_NOT_IN_CYCLE', 'Ada pesanan produk tanpa harga siklus')
  }
  if (cycle.weeklyPrices.some((price) => price.targetGroupSnapshot === null || price.unitSnapshot === null)) {
    throw new ServiceError(422, 'PRODUCT_MAPPING_REQUIRED', 'Pemetaan produk siklus belum lengkap')
  }

  const lines = cycle.weeklyPrices.map((price) => ({
    productId: price.productId,
    productName: price.product.name,
    unit: price.unitSnapshot!,
    groupCode: price.targetGroupSnapshot!,
    demand: formatScaled(demandByProduct.get(price.productId) ?? 0n),
  }))
  const targetAmounts = Object.fromEntries(cycle.targets.map((target) => [target.groupCode, target.quantity.toFixed(2)])) as Record<'AYAM' | 'TAHU', string>
  const groups = (['AYAM', 'TAHU'] as const).map((groupCode) => {
    const demand = formatScaled(lines.filter((line) => line.groupCode === groupCode).reduce((sum, line) => sum + parseScaled(line.demand, 2, 8), 0n))
    return { groupCode, target: targetAmounts[groupCode], demand, ...targetProgress(targetAmounts[groupCode], demand) }
  })
  return { cycle, lines, groups, targetAmounts }
}

export async function getSupplierRecap(prisma: PrismaClient, cycleId: string) {
  const source = await loadRecapSource(prisma, cycleId)
  const snapshot = source.cycle.supplierRecap
  return {
    cycleId,
    cycleVersion: source.cycle.version,
    periodState: source.cycle.periodState,
    groups: source.groups,
    items: source.lines,
    confirmed: snapshot ? {
      id: snapshot.id,
      confirmedAt: snapshot.confirmedAt.toISOString(),
      cycleVersionAtConfirm: snapshot.cycleVersionAtConfirm,
      targetSnapshot: snapshot.targetSnapshot,
      items: snapshot.items.map((item) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        unit: item.unitSnapshot,
        groupCode: item.groupSnapshot,
        quantity: item.quantity.toFixed(2),
      })),
      whatsappText: formatSupplierMessage(source.cycle.label, snapshot.items.map((item) => ({
        productName: item.productNameSnapshot, unit: item.unitSnapshot,
        quantity: item.quantity.toFixed(2),
      }))),
    } : null,
  }
}

export function formatSupplierMessage(label: string, lines: { productName: string; unit: string; quantity: string }[]) {
  return [`Rekap pembelian ${label}`, ...lines.map((line) => `- ${line.productName}: ${line.quantity} ${line.unit}`)].join('\n')
}

export async function confirmSupplierRecap(prisma: PrismaClient, input: {
  actorId: string; key: string; id: string; expectedVersion: number; items: RecapInput[]
}) {
  const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new ServiceError(400, 'DUPLICATE_PRODUCT', 'Produk rekap tidak boleh duplikat')
  }
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'supplier-recap.confirm', key: input.key,
    payload: { id: input.id, expectedVersion: input.expectedVersion, items },
  }, async (tx) => {
    await lockCycle(tx, input.id)
    const source = await loadRecapSource(tx, input.id)
    if (source.cycle.version !== input.expectedVersion) {
      throw new ServiceError(409, 'STALE_VERSION', 'Pesanan atau target berubah; periksa rekap lagi', { currentVersion: source.cycle.version })
    }
    if (source.cycle.periodState !== 'open') throw new ServiceError(409, 'CYCLE_NOT_OPEN', 'Rekap hanya dapat dikonfirmasi pada siklus terbuka')
    if (source.cycle.supplierRecap) throw new ServiceError(409, 'RECAP_ALREADY_CONFIRMED', 'Rekap minggu ini sudah dikonfirmasi')
    const quantityByProduct = new Map(items.map((item) => [item.productId, item.quantity]))
    if (items.some((item) => !source.lines.some((line) => line.productId === item.productId))) {
      throw new ServiceError(422, 'PRODUCT_NOT_IN_CYCLE', 'Produk rekap tidak ada pada siklus')
    }
    const allocations = source.lines.map((line) => ({
      productId: line.productId,
      groupCode: line.groupCode,
      demand: line.demand,
      proposed: quantityByProduct.get(line.productId) ?? '0.00',
    }))
    try { validateRecapAllocation(source.targetAmounts, allocations) }
    catch (error) { throw new ServiceError(422, 'INVALID_RECAP_ALLOCATION', `Alokasi rekap tidak sesuai: ${(error as Error).message}`) }

    const confirmedAt = new Date()
    const recap = await tx.supplierRecap.create({
      data: {
        cycleId: input.id,
        confirmedAt,
        actorId: input.actorId,
        cycleVersionAtConfirm: source.cycle.version,
        targetSnapshot: source.cycle.targets.map((target) => ({ groupCode: target.groupCode, quantity: target.quantity.toFixed(2), unit: target.unit })) as Prisma.InputJsonValue,
        items: { create: source.lines.flatMap((line) => {
          const quantity = quantityByProduct.get(line.productId) ?? '0.00'
          if (parseScaled(quantity, 2, 8) === 0n) return []
          return [{ productId: line.productId, quantity, productNameSnapshot: line.productName, unitSnapshot: line.unit, groupSnapshot: line.groupCode }]
        }) },
      }, include: { items: true },
    })
    await tx.cycle.update({ where: { id: input.id }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'cycle', entityId: input.id, action: 'supplier_recap_confirmed',
      after: { recapId: recap.id, itemCount: recap.items.length, targetSnapshot: recap.targetSnapshot },
    } })
    return { status: 201, body: { id: recap.id, cycleId: input.id, confirmedAt: confirmedAt.toISOString(), cycleVersionAtConfirm: source.cycle.version, items: recap.items.map((item) => ({ productId: item.productId, quantity: item.quantity.toFixed(2) })) } }
  })
}
