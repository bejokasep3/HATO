import { Prisma, type Cycle, type CycleTarget, type PrismaClient } from '@prisma/client'
import { cycleDates } from '../domain/calendar'
import { lineSubtotal, sumMoney } from '../domain/money'
import { ServiceError, lockCycle, runIdempotent, type MutationResponse, type Tx } from './mutation'

type TargetInput = { groupCode: 'AYAM' | 'TAHU'; quantity: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const dbDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const dateText = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null

function cycleLabel(periodStart: string) {
  const date = dbDate(periodStart)
  return `Minggu ${Math.ceil(date.getUTCDate() / 7)} - ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function cycleDto(cycle: Cycle & { targets: CycleTarget[] }) {
  return {
    id: cycle.id,
    label: cycle.label,
    periodStart: dateText(cycle.periodStart),
    periodEnd: dateText(cycle.periodEnd),
    supplierDeadline: dateText(cycle.supplierDeadline),
    deliveryDate: dateText(cycle.deliveryDate),
    periodState: cycle.periodState,
    version: cycle.version,
    notes: cycle.notes,
    targets: cycle.targets.map((target) => ({ groupCode: target.groupCode, quantity: target.quantity.toFixed(2), unit: target.unit })),
  }
}

async function lockedCycle(tx: Tx, id: string) {
  await lockCycle(tx, id)
  const cycle = await tx.cycle.findUnique({ where: { id }, include: { targets: true } })
  if (!cycle) throw new ServiceError(404, 'CYCLE_NOT_FOUND', 'Siklus tidak ditemukan')
  if (cycle.rulesVersion !== 2 || !cycle.periodState) {
    throw new ServiceError(409, 'LEGACY_CYCLE_READ_ONLY', 'Siklus lama perlu direkonsiliasi sebelum diubah')
  }
  return cycle
}

function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new ServiceError(409, 'STALE_VERSION', 'Data siklus telah berubah; muat ulang', { currentVersion: actual })
}

async function prepareRotation(tx: Tx, cycleId: string) {
  const groups = await tx.group.findMany({
    where: { isActive: true },
    include: { members: { where: { isActive: true }, include: { rotationSchedules: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
  })
  const selected = groups.flatMap((group) => [...group.members]
    .sort((a, b) => (a.rotationSchedules[0]?.createdAt.getTime() ?? 0) - (b.rotationSchedules[0]?.createdAt.getTime() ?? 0))
    .slice(0, 2)
    .map((member) => ({ cycleId, memberId: member.id, status: 'scheduled' })))
  if (selected.length) await tx.rotationSchedule.createMany({ data: selected, skipDuplicates: true })
}

export async function createCycle(
  prisma: PrismaClient,
  input: { actorId: string; key: string; periodStart: string; targets: TargetInput[]; notes?: string | null; copyPreviousPrices?: boolean },
): Promise<MutationResponse> {
  let dates: ReturnType<typeof cycleDates>
  try { dates = cycleDates(input.periodStart) } catch { throw new ServiceError(400, 'INVALID_PERIOD_START', 'Siklus harus dimulai hari Senin') }
  const targets = [...input.targets].sort((a, b) => a.groupCode.localeCompare(b.groupCode))
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'cycle.create', key: input.key,
    payload: { periodStart: input.periodStart, targets, notes: input.notes ?? null, ...(input.copyPreviousPrices === false ? { copyPreviousPrices: false } : {}) },
  }, async (tx) => {
    const existingWeek = await tx.cycle.findUnique({ where: { weekKey: dbDate(input.periodStart) } })
    if (existingWeek) throw new ServiceError(409, 'WEEK_ALREADY_EXISTS', 'Siklus minggu ini sudah ada')
    const products = await tx.product.findMany({ where: { isActive: true } })
    const unmapped = products.filter((product) => product.targetGroup === null || product.quantityScale === null)
    if (unmapped.length) {
      throw new ServiceError(422, 'PRODUCT_MAPPING_REQUIRED', 'Pemetaan kelompok dan satuan produk belum lengkap', { count: unmapped.length })
    }

    const previous = await tx.cycle.findFirst({
      where: { periodStart: { lt: dbDate(input.periodStart) } },
      orderBy: { periodStart: 'desc' }, include: { weeklyPrices: true },
    })
    const previousPrices = new Map(previous?.weeklyPrices.map((price) => [price.productId, price]) ?? [])
    const cycle = await tx.cycle.create({
      data: {
        label: cycleLabel(input.periodStart),
        periodStart: dbDate(input.periodStart),
        periodEnd: dbDate(dates.periodEnd),
        orderDeadline: dbDate(dates.supplierDeadline),
        supplierDeadline: dbDate(dates.supplierDeadline),
        deliveryDate: dbDate(dates.deliveryDate),
        weekKey: dbDate(input.periodStart),
        status: 'draft', periodState: 'draft', rulesVersion: 2,
        notes: input.notes ?? null,
        targets: { create: targets.map((target) => ({ groupCode: target.groupCode, quantity: target.quantity, unit: target.groupCode === 'AYAM' ? 'kg' : 'bungkus' })) },
      }, include: { targets: true },
    })

    for (const product of products) {
      const prior = input.copyPreviousPrices === false ? undefined : previousPrices.get(product.id)
      await tx.weeklyPrice.create({ data: {
        cycleId: cycle.id,
        productId: product.id,
        price: prior?.price ?? 0,
        consumerPrice: prior?.consumerPrice ?? null,
        traderPrice: prior?.traderPrice ?? null,
        targetGroupSnapshot: product.targetGroup,
        unitSnapshot: product.unit,
        quantityScaleSnapshot: product.quantityScale,
      } })
    }
    await prepareRotation(tx, cycle.id)
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'cycle', entityId: cycle.id, action: 'created',
      after: { periodStart: input.periodStart, targets },
    } })
    return { status: 201, body: cycleDto(cycle) }
  })
}

export async function openCycle(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number }) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'cycle.open', key: input.key, payload: { id: input.id, expectedVersion: input.expectedVersion } }, async (tx) => {
    const cycle = await lockedCycle(tx, input.id)
    checkVersion(cycle.version, input.expectedVersion)
    if (cycle.periodState !== 'draft') throw new ServiceError(409, 'INVALID_CYCLE_STATE', 'Hanya siklus draf yang dapat dibuka')
    if (cycle.targets.length !== 2 || !cycle.targets.some((target) => target.groupCode === 'AYAM') || !cycle.targets.some((target) => target.groupCode === 'TAHU')) {
      throw new ServiceError(422, 'TARGETS_REQUIRED', 'Target ayam dan tahu harus tersedia')
    }
    const prices = await tx.weeklyPrice.findMany({ where: { cycleId: input.id }, include: { product: true } })
    const unready = prices.filter((price) => price.product.isActive && (
      price.targetGroupSnapshot === null || price.unitSnapshot === null || price.quantityScaleSnapshot === null ||
      (price.consumerPrice ?? price.price).lte(0) || (price.traderPrice ?? price.consumerPrice ?? price.price).lte(0)
    ))
    if (!prices.length || unready.length) throw new ServiceError(422, 'PRICES_NOT_READY', 'Harga dan pemetaan produk aktif belum lengkap', { count: unready.length })
    const priceMap = new Map(prices.map((price) => [price.productId, price]))
    const pendingOrders = await tx.order.findMany({ where: { cycleId: input.id }, include: { items: true, payments: true } })
    const pricedLines: Prisma.Sql[] = []
    const pricedOrders: { id: string; totalAmount: string }[] = []
    for (const order of pendingOrders) {
      if (order.ledgerReconciledAt || order.payments.length) {
        throw new ServiceError(409, 'DRAFT_LEDGER_CONFLICT', 'Periksa saldo pesanan sebelum mengunci harga minggu ini')
      }
      const subtotals: string[] = []
      for (const item of order.items) {
        const price = priceMap.get(item.productId)
        const selected = item.priceType === 'trader' ? (price?.traderPrice ?? price?.consumerPrice ?? price?.price) : (price?.consumerPrice ?? price?.price)
        if (!selected || selected.lte(0)) throw new ServiceError(422, 'PRICES_NOT_READY', 'Harga pesanan belum lengkap', { productId: item.productId })
        const unitPrice = selected.toFixed(2)
        const subtotal = lineSubtotal(unitPrice, item.quantity.toFixed(2))
        subtotals.push(subtotal)
        pricedLines.push(Prisma.sql`(${item.id}::uuid, ${unitPrice}::numeric, ${subtotal}::numeric)`)
      }
      if (!subtotals.length) throw new ServiceError(422, 'ORDER_ITEMS_REQUIRED', 'Periksa pesanan tanpa produk sebelum mengunci harga')
      pricedOrders.push({ id: order.id, totalAmount: sumMoney(subtotals) })
    }
    if (pricedLines.length) {
      await tx.$executeRaw`
        UPDATE order_items AS item SET unit_price = priced.unit_price, subtotal = priced.subtotal
        FROM (VALUES ${Prisma.join(pricedLines)}) AS priced(id, unit_price, subtotal)
        WHERE item.id = priced.id
      `
      const totals = pricedOrders.map((order) => Prisma.sql`(${order.id}::uuid, ${order.totalAmount}::numeric)`)
      await tx.$executeRaw`
        UPDATE orders AS orders SET total_amount = priced.total_amount,
          ledger_reconciled_at = ${new Date()}, ledger_reconciled_by = ${input.actorId}::uuid,
          payment_status = 'unpaid', version = orders.version + 1, updated_at = ${new Date()}
        FROM (VALUES ${Prisma.join(totals)}) AS priced(id, total_amount)
        WHERE orders.id = priced.id
      `
      await tx.auditEvent.createMany({ data: pricedOrders.map((order) => ({
        actorId: input.actorId, entityType: 'order', entityId: order.id, action: 'priced', after: { totalAmount: order.totalAmount },
      })) })
    }
    const updated = await tx.cycle.update({ where: { id: input.id }, data: { periodState: 'open', status: 'open', version: { increment: 1 } }, include: { targets: true } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'cycle', entityId: input.id, action: 'opened', before: { version: cycle.version }, after: { version: updated.version } } })
    return { status: 200, body: cycleDto(updated) }
  })
}

export async function closeCycle(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number }) {
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'cycle.close', key: input.key, payload: { id: input.id, expectedVersion: input.expectedVersion } }, async (tx) => {
    const cycle = await lockedCycle(tx, input.id)
    checkVersion(cycle.version, input.expectedVersion)
    if (cycle.periodState !== 'open') throw new ServiceError(409, 'INVALID_CYCLE_STATE', 'Hanya siklus terbuka yang dapat ditutup')
    const updated = await tx.cycle.update({ where: { id: input.id }, data: { periodState: 'closed', status: 'closed', version: { increment: 1 } }, include: { targets: true } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'cycle', entityId: input.id, action: 'closed', before: { version: cycle.version }, after: { version: updated.version } } })
    return { status: 200, body: cycleDto(updated) }
  })
}

export async function changeTargets(prisma: PrismaClient, input: { actorId: string; key: string; id: string; expectedVersion: number; reason: string; targets: TargetInput[] }) {
  const targets = [...input.targets].sort((a, b) => a.groupCode.localeCompare(b.groupCode))
  return runIdempotent(prisma, { actorId: input.actorId, operation: 'cycle.targets', key: input.key, payload: { id: input.id, expectedVersion: input.expectedVersion, reason: input.reason, targets } }, async (tx) => {
    await lockCycle(tx, input.id)
    const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: input.id }, include: { targets: true } })
    checkVersion(cycle.version, input.expectedVersion)
    if (cycle.periodState === 'closed') throw new ServiceError(409, 'CYCLE_CLOSED', 'Target siklus tertutup tidak dapat diubah')
    const before = cycle.targets.map((target) => ({ groupCode: target.groupCode, quantity: target.quantity.toFixed(2) }))
    for (const target of targets) {
      await tx.cycleTarget.upsert({
        where: { cycleId_groupCode: { cycleId: input.id, groupCode: target.groupCode } },
        create: { cycleId: input.id, groupCode: target.groupCode, quantity: target.quantity, unit: target.groupCode === 'AYAM' ? 'kg' : 'bungkus' },
        update: { quantity: target.quantity },
      })
    }
    const updated = await tx.cycle.update({ where: { id: input.id }, data: { version: { increment: 1 } }, include: { targets: true } })
    await tx.auditEvent.create({ data: { actorId: input.actorId, entityType: 'cycle', entityId: input.id, action: 'targets_changed', before: { targets: before }, after: { targets }, reason: input.reason } })
    return { status: 200, body: cycleDto(updated) }
  })
}

export async function setCyclePrices(prisma: PrismaClient, input: {
  actorId: string
  key: string
  id: string
  expectedVersion: number
  items: { productId: string; consumerPrice: string; traderPrice: string }[]
}) {
  const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new ServiceError(400, 'DUPLICATE_PRODUCT', 'Satu produk hanya boleh muncul sekali')
  }
  return runIdempotent(prisma, {
    actorId: input.actorId, operation: 'cycle.prices', key: input.key,
    payload: { id: input.id, expectedVersion: input.expectedVersion, items },
  }, async (tx) => {
    const cycle = await lockedCycle(tx, input.id)
    checkVersion(cycle.version, input.expectedVersion)
    if (cycle.periodState !== 'draft') throw new ServiceError(409, 'PRICES_LOCKED', 'Harga dibekukan setelah siklus dibuka')
    const existing = await tx.weeklyPrice.findMany({ where: { cycleId: input.id, productId: { in: items.map((item) => item.productId) } } })
    if (existing.length !== items.length) throw new ServiceError(422, 'PRODUCT_NOT_IN_CYCLE', 'Produk harus ditambahkan eksplisit pada siklus')
    const before = existing.map((price) => ({ productId: price.productId, consumerPrice: price.consumerPrice?.toFixed(2), traderPrice: price.traderPrice?.toFixed(2) }))
    for (const item of items) {
      await tx.weeklyPrice.update({
        where: { cycleId_productId: { cycleId: input.id, productId: item.productId } },
        data: { price: item.consumerPrice, consumerPrice: item.consumerPrice, traderPrice: item.traderPrice },
      })
    }
    const updated = await tx.cycle.update({ where: { id: input.id }, data: { version: { increment: 1 } }, include: { targets: true } })
    await tx.auditEvent.create({ data: {
      actorId: input.actorId, entityType: 'cycle', entityId: input.id, action: 'prices_changed',
      before: { prices: before }, after: { prices: items },
    } })
    return { status: 200, body: cycleDto(updated) }
  })
}
