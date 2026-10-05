import { prisma } from '@/lib/prisma'

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

export function getNowWIB(): Date {
  const now = new Date()
  const wibString = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  return new Date(wibString)
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateCycleLabel(startDate: Date): string {
  const dayOfMonth = startDate.getDate()
  const weekNumber = Math.ceil(dayOfMonth / 7)
  const monthName = MONTH_NAMES_ID[startDate.getMonth()]
  const year = startDate.getFullYear()
  return `Minggu ${weekNumber} - ${monthName} ${year}`
}

export interface TransitionCycleOptions {
  referenceDate?: Date
  forceNew?: boolean
  notes?: string
}

export async function transitionWeeklyCycle(options: TransitionCycleOptions = {}) {
  const baseDate = options.referenceDate ? new Date(options.referenceDate) : getNowWIB()
  const monday = getMondayOfWeek(baseDate)

  const tuesday = new Date(monday)
  tuesday.setDate(monday.getDate() + 1)

  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)

  const periodStartStr = formatISODate(monday)
  const orderDeadlineStr = formatISODate(tuesday)
  const deliveryDateStr = formatISODate(thursday)

  const periodStartDate = new Date(`${periodStartStr}T00:00:00.000Z`)
  const orderDeadlineDate = new Date(`${orderDeadlineStr}T00:00:00.000Z`)
  const deliveryDateDate = new Date(`${deliveryDateStr}T00:00:00.000Z`)

  if (!options.forceNew) {
    const existingCurrent = await prisma.cycle.findFirst({
      where: {
        periodStart: periodStartDate,
        status: 'open',
      },
    })

    if (existingCurrent) {
      return {
        alreadyActive: true,
        cycle: existingCurrent,
        completedCount: 0,
        message: `Siklus ${existingCurrent.label} untuk minggu ini sudah aktif.`,
      }
    }
  }

  const completedResult = await prisma.cycle.updateMany({
    where: { status: 'open' },
    data: { status: 'completed' },
  })

  const label = generateCycleLabel(monday)

  const newCycle = await prisma.cycle.create({
    data: {
      label,
      periodStart: periodStartDate,
      orderDeadline: orderDeadlineDate,
      deliveryDate: deliveryDateDate,
      status: 'open',
      notes: options.notes || 'Siklus mingguan otomatis (Senin - Kamis)',
    },
  })

  const previousCycle = await prisma.cycle.findFirst({
    where: { id: { not: newCycle.id } },
    orderBy: { periodStart: 'desc' },
    include: { weeklyPrices: true },
  })

  let copiedPricesCount = 0
  if (previousCycle && previousCycle.weeklyPrices.length > 0) {
    for (const wp of previousCycle.weeklyPrices) {
      await prisma.weeklyPrice.create({
        data: {
          cycleId: newCycle.id,
          productId: wp.productId,
          price: wp.price,
          consumerPrice: wp.consumerPrice,
          traderPrice: wp.traderPrice,
        },
      })
      copiedPricesCount++
    }
  } else {
    const activeProducts = await prisma.product.findMany({ where: { isActive: true } })
    for (const prod of activeProducts) {
      await prisma.weeklyPrice.create({
        data: {
          cycleId: newCycle.id,
          productId: prod.id,
          price: 0,
          consumerPrice: 0,
          traderPrice: 0,
        },
      })
      copiedPricesCount++
    }
  }

  return {
    alreadyActive: false,
    cycle: newCycle,
    completedCount: completedResult.count,
    copiedPricesCount,
    message: `Siklus ${newCycle.label} berhasil dibuka. ${completedResult.count} siklus sebelumnya ditandai completed.`,
  }
}
