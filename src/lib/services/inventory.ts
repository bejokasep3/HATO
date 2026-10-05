import { type PrismaClient } from '@prisma/client'
import { parseScaled } from '../domain/money'
import { ServiceError, lockCycle, runIdempotent } from './mutation'

type ReceiptLine = {
  productId: string
  receivedQty: string
  damagedQty: string
  purchasePrice: string
  notes?: string | null
}

export async function saveReceiptDraft(prisma: PrismaClient, input: {
  actorId: string; key: string; cycleId: string; expectedVersion: number
  supplierNote?: string | null; items: ReceiptLine[]
}) {
  const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new ServiceError(400, 'DUPLICATE_PRODUCT', 'Produk penerimaan tidak boleh duplikat')
  }
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'receipt.draft', key: input.key,
    payload: { cycleId: input.cycleId, expectedVersion: input.expectedVersion, supplierNote: input.supplierNote ?? null, items },
  }, async (tx) => {
    await lockCycle(tx, input.cycleId)
    const cycle = await tx.cycle.findUnique({
      where: { id: input.cycleId },
      include: { supplierRecap: { include: { items: true } }, goodsReceipt: true, weeklyPrices: true },
    })
    if (!cycle || cycle.rulesVersion !== 2) throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Penerimaan siklus lama belum diverifikasi')
    if (cycle.version !== input.expectedVersion) throw new ServiceError(409, 'STALE_VERSION', 'Siklus telah berubah; muat ulang', { currentVersion: cycle.version })
    if (!cycle.supplierRecap) throw new ServiceError(409, 'RECAP_REQUIRED', 'Konfirmasi rekap supplier terlebih dahulu')
    if (cycle.goodsReceipt?.status === 'confirmed') throw new ServiceError(409, 'RECEIPT_CONFIRMED', 'Penerimaan yang sudah dikonfirmasi tidak dapat diganti')
    const prices = new Map(cycle.weeklyPrices.map((price) => [price.productId, price]))
    const recap = new Map(cycle.supplierRecap.items.map((item) => [item.productId, item.quantity.toFixed(2)]))
    for (const item of items) {
      const price = prices.get(item.productId)
      if (!price || price.quantityScaleSnapshot === null) throw new ServiceError(422, 'PRODUCT_NOT_IN_CYCLE', 'Produk tidak ada pada siklus', { productId: item.productId })
      try {
        const received = parseScaled(item.receivedQty, price.quantityScaleSnapshot as 0 | 2, 8)
        const damaged = parseScaled(item.damagedQty, price.quantityScaleSnapshot as 0 | 2, 8)
        parseScaled(item.purchasePrice, 2, 10)
        if (damaged > received) throw new Error('DAMAGED_EXCEEDS_RECEIVED')
      } catch {
        throw new ServiceError(400, 'INVALID_RECEIPT_QUANTITY', 'Jumlah diterima/rusak tidak sesuai', { productId: item.productId })
      }
    }

    const receipt = await tx.goodsReceipt.upsert({
      where: { cycleId: input.cycleId },
      create: { cycleId: input.cycleId, supplierNote: input.supplierNote ?? null, status: 'draft' },
      update: { supplierNote: input.supplierNote ?? null, version: { increment: 1 } },
    })
    await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: receipt.id } })
    if (items.length) await tx.goodsReceiptItem.createMany({ data: items.map((item) => ({
      goodsReceiptId: receipt.id,
      productId: item.productId,
      orderedQty: recap.get(item.productId) ?? '0.00',
      receivedQty: item.receivedQty,
      damagedQty: item.damagedQty,
      purchasePrice: item.purchasePrice,
      notes: item.notes ?? null,
    })) })
    await tx.cycle.update({ where: { id: input.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'goods_receipt', entityId: receipt.id, action: 'draft_saved',
      after: { cycleId: input.cycleId, itemCount: items.length, receiptVersion: receipt.version },
    } })
    return { status: 200, body: { id: receipt.id, cycleId: input.cycleId, status: 'draft', version: receipt.version, cycleVersion: cycle.version + 1 } }
  })
}

export async function confirmReceipt(prisma: PrismaClient, input: {
  actorId: string; key: string; cycleId: string; expectedVersion: number
}) {
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'receipt.confirm', key: input.key,
    payload: { cycleId: input.cycleId, expectedVersion: input.expectedVersion },
  }, async (tx) => {
    await lockCycle(tx, input.cycleId)
    const cycle = await tx.cycle.findUnique({
      where: { id: input.cycleId },
      include: { supplierRecap: { include: { items: true } }, goodsReceipt: { include: { items: true } } },
    })
    if (!cycle || cycle.rulesVersion !== 2) throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Penerimaan siklus lama belum diverifikasi')
    if (cycle.version !== input.expectedVersion) throw new ServiceError(409, 'STALE_VERSION', 'Siklus telah berubah; muat ulang', { currentVersion: cycle.version })
    if (!cycle.supplierRecap) throw new ServiceError(409, 'RECAP_REQUIRED', 'Rekap supplier belum dikonfirmasi')
    if (!cycle.goodsReceipt || cycle.goodsReceipt.status !== 'draft') throw new ServiceError(409, 'RECEIPT_DRAFT_REQUIRED', 'Simpan penerimaan draf terlebih dahulu')
    const receivedProducts = new Set(cycle.goodsReceipt.items.map((item) => item.productId))
    if (cycle.supplierRecap.items.some((item) => !receivedProducts.has(item.productId))) {
      throw new ServiceError(422, 'RECEIPT_ITEMS_MISSING', 'Semua produk rekap harus dicatat, termasuk yang diterima nol')
    }
    const confirmedAt = new Date()
    const receipt = await tx.goodsReceipt.update({
      where: { cycleId: input.cycleId },
      data: { status: 'confirmed', confirmedAt, confirmedBy: input.actorId, version: { increment: 1 } },
    })
    await tx.cycle.update({ where: { id: input.cycleId }, data: { version: { increment: 1 } } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'goods_receipt', entityId: receipt.id, action: 'confirmed',
      after: { cycleId: input.cycleId, confirmedAt: confirmedAt.toISOString(), itemCount: cycle.goodsReceipt.items.length },
    } })
    return { status: 200, body: { id: receipt.id, cycleId: input.cycleId, status: 'confirmed', version: receipt.version, cycleVersion: cycle.version + 1, confirmedAt: confirmedAt.toISOString() } }
  })
}
